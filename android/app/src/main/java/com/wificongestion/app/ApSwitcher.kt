package com.wificongestion.app

import android.content.Context
import android.net.ConnectivityManager
import android.net.MacAddress
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.wifi.WifiNetworkSpecifier
import android.os.Handler
import android.os.Looper
import kotlin.coroutines.resume
import kotlin.coroutines.suspendCoroutine

class ApSwitcher(context: Context) {

    private val appContext = context.applicationContext
    private val connectivityManager =
        appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    suspend fun switchTo(ssid: String, bssid: String, timeoutMs: Long = 8000L): Boolean =
        suspendCoroutine { continuation ->
            var resumed = false
            val handler = Handler(Looper.getMainLooper())

            val specifier = try {
                WifiNetworkSpecifier.Builder()
                    .setSsid(ssid)
                    .setBssid(MacAddress.fromString(bssid))
                    .build()
            } catch (e: IllegalArgumentException) {
                continuation.resume(false)
                return@suspendCoroutine
            }

            val request = NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .setNetworkSpecifier(specifier)
                .build()

            val callback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    if (resumed) return
                    resumed = true
                    handler.removeCallbacksAndMessages(null)
                    val bound = connectivityManager.bindProcessToNetwork(network)
                    if (bound) {
                        lastSwitchedNetwork = network
                        lastSwitchedBssid = bssid
                    }
                    continuation.resume(bound)
                }

                override fun onUnavailable() {
                    if (resumed) return
                    resumed = true
                    handler.removeCallbacksAndMessages(null)
                    continuation.resume(false)
                }
            }

            handler.postDelayed({
                if (resumed) return@postDelayed
                resumed = true
                try {
                    connectivityManager.unregisterNetworkCallback(callback)
                } catch (e: IllegalArgumentException) {
                    // already unregistered
                }
                continuation.resume(false)
            }, timeoutMs)

            connectivityManager.requestNetwork(request, callback)
        }

    companion object {
        @Volatile
        var lastSwitchedNetwork: Network? = null
            private set

        @Volatile
        var lastSwitchedBssid: String? = null
            private set
    }
}
