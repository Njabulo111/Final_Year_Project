package com.wificongestion.app

import android.Manifest
import android.content.Intent
import android.net.Uri
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.PermissionState
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.getcapacitor.annotation.PermissionCallback
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(
    name = "WifiMonitor",
    permissions = [
        Permission(
            strings = [Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION],
            alias = "location",
        ),
        Permission(strings = [Manifest.permission.NEARBY_WIFI_DEVICES], alias = "nearbyWifi"),
        Permission(strings = [Manifest.permission.POST_NOTIFICATIONS], alias = "notifications"),
    ],
)
class WifiMonitorPlugin : Plugin() {

    private val pluginScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val wifiScanner by lazy { WifiScanner(context) }
    private val networkTester by lazy { NetworkTester() }
    private val apSwitcher by lazy { ApSwitcher(context) }
    private val trafficWatcher = TrafficWatcher()
    private val downloadTester by lazy { DownloadTester() }
    private val researchDb by lazy { ResearchDatabase.getInstance(context) }

    @PluginMethod
    fun scanNetworks(call: PluginCall) {
        if (getPermissionState("location") != PermissionState.GRANTED) {
            requestPermissionForAlias("location", call, "scanPermsCallback")
            return
        }
        performScan(call)
    }

    @PermissionCallback
    private fun scanPermsCallback(call: PluginCall) {
        if (getPermissionState("location") == PermissionState.GRANTED) {
            performScan(call)
        } else {
            call.reject("Location permission is required to scan WiFi networks")
        }
    }

    private fun performScan(call: PluginCall) {
        pluginScope.launch {
            val results = wifiScanner.scan()
            val apsArray = JSArray()
            for (ap in results) {
                val obj = JSObject()
                obj.put("ssid", ap.ssid)
                obj.put("bssid", ap.bssid)
                obj.put("rssi", ap.rssi)
                obj.put("channel", ap.channel)
                obj.put("frequency", ap.frequency)
                obj.put("isConnected", ap.isConnected)
                apsArray.put(obj)
            }

            val ret = JSObject()
            ret.put("aps", apsArray)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun testNetwork(call: PluginCall) {
        pluginScope.launch {
            val host = call.getString("host") ?: wifiScanner.getGatewayAddress() ?: "8.8.8.8"
            val result = networkTester.ping(host)

            val ret = JSObject()
            ret.put("latencyMs", result.latencyMs)
            ret.put("packetLossPct", result.packetLossPct)
            ret.put("reachable", result.reachable)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun getConnectionInfo(call: PluginCall) {
        val ret = JSObject()
        ret.put("rssi", wifiScanner.getConnectedRssi())
        ret.put("linkSpeedMbps", wifiScanner.getLinkSpeedMbps())
        ret.put("gateway", wifiScanner.getGatewayAddress())
        call.resolve(ret)
    }

    @PluginMethod
    fun switchToBssid(call: PluginCall) {
        val ssid = call.getString("ssid")
        val bssid = call.getString("bssid")
        if (ssid == null || bssid == null) {
            call.reject("ssid and bssid are required")
            return
        }

        if (getPermissionState("location") != PermissionState.GRANTED) {
            call.reject("Location permission is required to switch access points")
            return
        }

        pluginScope.launch {
            val success = apSwitcher.switchTo(ssid, bssid)
            val ret = JSObject()
            ret.put("success", success)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun testDownload(call: PluginCall) {
        pluginScope.launch {
            val network = ApSwitcher.lastSwitchedNetwork
            val reachable = downloadTester.canDownload(network)

            if (!reachable) {
                AppNotifications.postAlert(
                    context,
                    "No internet on that access point",
                    "The AP you just switched to could not complete a test download. It may not have working internet.",
                )
            }

            val ret = JSObject()
            ret.put("success", reachable)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun logScan(call: PluginCall) {
        pluginScope.launch {
            withContext(Dispatchers.IO) {
                researchDb.insertScan(
                    ScanHistoryRow(
                        scanId = 0,
                        timestamp = isoNow(),
                        ssid = call.getString("ssid") ?: "",
                        bssid = call.getString("bssid") ?: "",
                        rssiDbm = call.getInt("rssi") ?: -99,
                        latencyMs = call.getDouble("latencyMs") ?: 0.0,
                        packetLossPct = call.getDouble("packetLossPct") ?: 0.0,
                        signalScore = call.getInt("signalScore") ?: 0,
                        latencyScore = call.getInt("latencyScore") ?: 0,
                        packetlossScore = call.getInt("lossScore") ?: 0,
                        stabilityScore = call.getInt("stabilityScore") ?: 0,
                        totalScore = call.getInt("totalScore") ?: 0,
                        status = call.getString("status") ?: "fair",
                        connected = true,
                    )
                )
            }
            call.resolve()
        }
    }

    @PluginMethod
    fun getScanHistoryCount(call: PluginCall) {
        pluginScope.launch {
            val count = withContext(Dispatchers.IO) { researchDb.getScanHistoryCount() }
            val ret = JSObject()
            ret.put("count", count)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun getScanHistorySample(call: PluginCall) {
        pluginScope.launch {
            val limit = call.getInt("limit", 200) ?: 200
            val rows = withContext(Dispatchers.IO) { researchDb.getRecentScans(limit) }
            val array = JSArray()
            for (row in rows) {
                val obj = JSObject()
                obj.put("timestamp", row.timestamp)
                obj.put("signalScore", row.signalScore)
                obj.put("latencyScore", row.latencyScore)
                obj.put("lossScore", row.packetlossScore)
                obj.put("stabilityScore", row.stabilityScore)
                obj.put("totalScore", row.totalScore)
                array.put(obj)
            }
            val ret = JSObject()
            ret.put("rows", array)
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun getResearchWeights(call: PluginCall) {
        pluginScope.launch {
            val weights = withContext(Dispatchers.IO) { researchDb.getWeights() }
            val obj = JSObject()
            weights.forEach { obj.put(it.metric, it.weight) }
            call.resolve(obj)
        }
    }

    @PluginMethod
    fun updateResearchWeight(call: PluginCall) {
        val metric = call.getString("metric")
        val weight = call.getDouble("weight")
        if (metric == null || weight == null) {
            call.reject("metric and weight are required")
            return
        }
        val notes = call.getString("notes") ?: "Adaptive recalibration from device usage"

        pluginScope.launch {
            withContext(Dispatchers.IO) { researchDb.updateWeight(metric, weight, notes) }
            call.resolve()
        }
    }

    @PluginMethod
    fun exportResearchData(call: PluginCall) {
        pluginScope.launch {
            val csvs = withContext(Dispatchers.IO) { researchDb.exportAllAsCsv() }

            val exportDir = File(context.cacheDir, "research-export").apply { mkdirs() }
            val uris = ArrayList<Uri>()

            withContext(Dispatchers.IO) {
                csvs.forEach { (name, content) ->
                    val file = File(exportDir, "$name.csv")
                    FileOutputStream(file).use { it.write(content.toByteArray()) }
                    uris.add(FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file))
                }
            }

            if (uris.isEmpty()) {
                call.reject("No data to export")
                return@launch
            }

            val shareIntent = Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                type = "text/csv"
                putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.startActivity(Intent.createChooser(shareIntent, "Export WiFi Monitor research data"))

            call.resolve()
        }
    }

    @PluginMethod
    fun startBackgroundMonitor(call: PluginCall) {
        if (getPermissionState("notifications") != PermissionState.GRANTED) {
            requestPermissionForAlias("notifications", call, "backgroundMonitorPermsCallback")
            return
        }
        beginBackgroundMonitor(call)
    }

    @PermissionCallback
    private fun backgroundMonitorPermsCallback(call: PluginCall) {
        beginBackgroundMonitor(call)
    }

    private fun beginBackgroundMonitor(call: PluginCall) {
        val intervalSeconds = call.getInt("intervalSeconds", 15) ?: 15
        val congestionThreshold = call.getInt("congestionThreshold", 50) ?: 50
        MonitorService.start(context, intervalSeconds, congestionThreshold)
        call.resolve()
    }

    @PluginMethod
    fun stopBackgroundMonitor(call: PluginCall) {
        MonitorService.stop(context)
        call.resolve()
    }

    @PluginMethod
    fun checkForUpdate(call: PluginCall) {
        pluginScope.launch {
            val currentVersionCode = try {
                context.packageManager.getPackageInfo(context.packageName, 0).let {
                    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) it.longVersionCode.toInt() else @Suppress("DEPRECATION") it.versionCode
                }
            } catch (e: Exception) {
                Int.MAX_VALUE // fail closed: never claim an update is available if we can't read our own version
            }

            val update = UpdateChecker.checkForUpdate(currentVersionCode)
            val ret = JSObject()
            if (update == null) {
                ret.put("updateAvailable", false)
            } else {
                ret.put("updateAvailable", true)
                ret.put("versionName", update.versionName)
                ret.put("releaseNotes", update.releaseNotes)
                ret.put("downloadUrl", update.downloadUrl)
            }
            call.resolve(ret)
        }
    }

    @PluginMethod
    fun downloadAndInstallUpdate(call: PluginCall) {
        val downloadUrl = call.getString("downloadUrl")
        if (downloadUrl == null) {
            call.reject("downloadUrl is required")
            return
        }
        pluginScope.launch {
            val file = withContext(Dispatchers.IO) { UpdateChecker.downloadUpdate(context, downloadUrl) }
            if (file == null) {
                call.reject("Update download failed")
                return@launch
            }
            UpdateChecker.launchInstaller(context, file)
            call.resolve()
        }
    }

    @PluginMethod
    fun getPendingSwitchRecommendation(call: PluginCall) {
        val prefs = context.getSharedPreferences(MonitorService.PREFS_NAME, android.content.Context.MODE_PRIVATE)
        val targetSsid = prefs.getString(MonitorService.PENDING_TARGET_SSID, null)
        val ret = JSObject()
        if (targetSsid == null) {
            ret.put("pending", false)
            call.resolve(ret)
            return
        }
        ret.put("pending", true)
        ret.put("targetSsid", targetSsid)
        ret.put("targetBssid", prefs.getString(MonitorService.PENDING_TARGET_BSSID, ""))
        ret.put("currentSsid", prefs.getString(MonitorService.PENDING_CURRENT_SSID, ""))
        ret.put("currentBssid", prefs.getString(MonitorService.PENDING_CURRENT_BSSID, ""))
        ret.put("targetScore", prefs.getFloat(MonitorService.PENDING_TARGET_SCORE, 0f).toDouble())
        ret.put("currentScore", prefs.getFloat(MonitorService.PENDING_CURRENT_SCORE, 0f).toDouble())
        ret.put("targetStability", prefs.getFloat(MonitorService.PENDING_TARGET_STABILITY, 0f).toDouble())
        ret.put("currentStability", prefs.getFloat(MonitorService.PENDING_CURRENT_STABILITY, 0f).toDouble())
        call.resolve(ret)
    }

    @PluginMethod
    fun respondToSwitchRecommendation(call: PluginCall) {
        val accepted = call.getBoolean("accepted") ?: false
        val connectSucceeded = if (call.data.has("connectSucceeded")) call.getBoolean("connectSucceeded") else null
        MonitorService.respondToPendingSwitch(context, accepted, connectSucceeded)
        call.resolve()
    }

    @PluginMethod
    fun startTrafficWatch(call: PluginCall) {
        val thresholdKB = call.getInt("thresholdKB", 500) ?: 500
        trafficWatcher.start(pluginScope, thresholdKB.toLong() * 1024L) {
            notifyListeners("trafficSpike", JSObject())
        }
        call.resolve()
    }

    @PluginMethod
    fun stopTrafficWatch(call: PluginCall) {
        trafficWatcher.stop()
        call.resolve()
    }

    override fun handleOnDestroy() {
        trafficWatcher.stop()
        super.handleOnDestroy()
    }
}
