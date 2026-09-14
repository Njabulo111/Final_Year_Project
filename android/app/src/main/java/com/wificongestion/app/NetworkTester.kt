package com.wificongestion.app

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStreamReader

data class NetworkTestResult(
    val latencyMs: Double,
    val packetLossPct: Double,
    val reachable: Boolean,
)

class NetworkTester {

    suspend fun ping(host: String, count: Int = 4, timeoutSeconds: Int = 2): NetworkTestResult =
        withContext(Dispatchers.IO) {
            try {
                val process = ProcessBuilder("/system/bin/ping", "-c", count.toString(), "-W", timeoutSeconds.toString(), host)
                    .redirectErrorStream(true)
                    .start()

                val output = BufferedReader(InputStreamReader(process.inputStream)).use { it.readText() }
                process.waitFor()

                parsePingOutput(output)
            } catch (e: Exception) {
                NetworkTestResult(latencyMs = 0.0, packetLossPct = 100.0, reachable = false)
            }
        }

    private fun parsePingOutput(output: String): NetworkTestResult {
        val lossMatch = Regex("""(\d+(?:\.\d+)?)%\s*packet loss""").find(output)
        val lossPct = lossMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: 100.0

        val rttMatch = Regex("""=\s*[\d.]+/([\d.]+)/[\d.]+""").find(output)
        val avgRttMs = rttMatch?.groupValues?.get(1)?.toDoubleOrNull() ?: 0.0

        return NetworkTestResult(
            latencyMs = avgRttMs,
            packetLossPct = lossPct,
            reachable = lossPct < 100.0,
        )
    }
}
