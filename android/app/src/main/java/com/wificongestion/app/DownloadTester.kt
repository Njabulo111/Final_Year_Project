package com.wificongestion.app

import android.net.Network
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import java.net.HttpURLConnection
import java.net.URL

class DownloadTester {

    suspend fun canDownload(
        network: Network?,
        testUrl: String = "https://www.gstatic.com/generate_204",
        timeoutMs: Long = 6000L,
    ): Boolean = withContext(Dispatchers.IO) {
        withTimeoutOrNull(timeoutMs) {
            try {
                val url = URL(testUrl)
                val connection = (network?.openConnection(url) ?: url.openConnection()) as HttpURLConnection
                connection.connectTimeout = timeoutMs.toInt()
                connection.readTimeout = timeoutMs.toInt()
                connection.requestMethod = "GET"
                connection.instanceFollowRedirects = true
                connection.connect()

                val code = connection.responseCode
                connection.inputStream?.use { it.readBytes() }
                connection.disconnect()

                code in 200..299 || code == 204
            } catch (e: Exception) {
                false
            }
        } ?: false
    }
}
