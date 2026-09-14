package com.wificongestion.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.wifi.WifiManager
import android.os.Handler
import android.os.Looper
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

data class ScannedAp(
    val ssid: String,
    val bssid: String,
    val rssi: Int,
    val channel: Int,
    val frequency: Int,
    val isConnected: Boolean,
)

class WifiScanner(context: Context) {

    private val appContext = context.applicationContext
    private val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as? WifiManager

    suspend fun scan(timeoutMs: Long = 5000L): List<ScannedAp> = suspendCoroutine { continuation ->
        val manager = wifiManager
        if (manager == null) {
            continuation.resume(emptyList())
            return@suspendCoroutine
        }

        var resumed = false
        val handler = Handler(Looper.getMainLooper())

        val receiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (resumed) return
                resumed = true
                handler.removeCallbacksAndMessages(null)
                try {
                    appContext.unregisterReceiver(this)
                } catch (e: IllegalArgumentException) {
                    // already unregistered
                }
                continuation.resume(collectResults(manager))
            }
        }

        appContext.registerReceiver(receiver, IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION))

        handler.postDelayed({
            if (resumed) return@postDelayed
            resumed = true
            try {
                appContext.unregisterReceiver(receiver)
            } catch (e: IllegalArgumentException) {
                // already unregistered
            }
            continuation.resume(collectResults(manager))
        }, timeoutMs)

        @Suppress("DEPRECATION")
        manager.startScan()
    }

    private fun collectResults(manager: WifiManager): List<ScannedAp> {
        val connectedBssid = manager.connectionInfo?.bssid
        val scanResults = try {
            manager.scanResults
        } catch (e: SecurityException) {
            emptyList()
        }

        val seenBssids = mutableSetOf<String>()
        val results = mutableListOf<ScannedAp>()

        for (result in scanResults) {
            val bssid = result.BSSID ?: continue
            if (!seenBssids.add(bssid)) continue

            results.add(
                ScannedAp(
                    ssid = result.SSID ?: "",
                    bssid = bssid,
                    rssi = result.level,
                    channel = frequencyToChannel(result.frequency),
                    frequency = result.frequency,
                    isConnected = connectedBssid != null && connectedBssid.equals(bssid, ignoreCase = true),
                )
            )
        }

        return results
    }

    fun getConnectedRssi(): Int = wifiManager?.connectionInfo?.rssi ?: -99

    fun getLinkSpeedMbps(): Int = wifiManager?.connectionInfo?.linkSpeed ?: 0

    fun getGatewayAddress(): String? {
        val dhcpInfo = wifiManager?.dhcpInfo ?: return null
        val gateway = dhcpInfo.gateway
        if (gateway == 0) return null
        return String.format(
            "%d.%d.%d.%d",
            gateway and 0xff,
            gateway shr 8 and 0xff,
            gateway shr 16 and 0xff,
            gateway shr 24 and 0xff,
        )
    }

    private fun frequencyToChannel(freqMHz: Int): Int {
        if (freqMHz == 2484) return 14
        if (freqMHz < 2484) return (freqMHz - 2407) / 5
        if (freqMHz >= 5160) return (freqMHz - 5000) / 5
        return 0
    }
}
