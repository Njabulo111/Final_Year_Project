package com.wificongestion.app

import java.util.ArrayDeque
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.sqrt

/**
 * One observation of a BSSID at a point in time. [linkSpeedMbps], [latencyMs] and
 * [packetLossPct] are only measurable for the AP the device is currently associated
 * with — Android does not expose link speed or round-trip timing for APs seen only
 * in a scan result. They are null for every non-connected sample.
 */
data class APSample(
    val bssid: String,
    val ssid: String,
    val rssi: Int,
    val linkSpeedMbps: Int?,
    val latencyMs: Double?,
    val packetLossPct: Double?,
    val timestampMs: Long,
)

/** Per-BSSID stability read-out for a given cycle. */
data class StabilityResult(
    val bssid: String,
    val sampleCount: Int,
    val hasSufficientData: Boolean,
    val stabilityScore: Double, // 0..100, only meaningful when hasSufficientData is true
)

/**
 * Maintains a rolling per-BSSID history of [APSample]s so stability can be judged from a
 * short time series instead of a single reading. Capped at [MAX_SAMPLES] (~30-60s of
 * history at a 2-4s scan interval); an AP needs at least [MIN_SAMPLES] before it is
 * eligible to influence switch decisions (`hasSufficientData = false` otherwise), mirroring
 * the `insufficient_data` gate already used for sparse heatmap cells.
 */
class ApHistoryTracker(
    private val maxSamples: Int = MAX_SAMPLES,
    private val minSamples: Int = MIN_SAMPLES,
) {
    private val buffers = ConcurrentHashMap<String, ArrayDeque<APSample>>()

    @Synchronized
    fun addSample(sample: APSample) {
        val buffer = buffers.getOrPut(sample.bssid) { ArrayDeque() }
        buffer.addLast(sample)
        while (buffer.size > maxSamples) {
            buffer.removeFirst()
        }
    }

    @Synchronized
    fun samplesFor(bssid: String): List<APSample> = buffers[bssid]?.toList() ?: emptyList()

    fun hasSufficientData(bssid: String): Boolean = samplesFor(bssid).size >= minSamples

    /**
     * stabilityScore = 0.6 * stabilityRSSI + 0.4 * stabilityLatency, each derived from
     * stddev(last N samples) normalized against a max-expected spread. When no latency
     * samples exist for this BSSID (true for every AP other than the currently connected
     * one), stability falls back to RSSI alone rather than diluting the score with an
     * arbitrary neutral latency term.
     */
    fun stabilityFor(bssid: String): StabilityResult {
        val samples = samplesFor(bssid)
        if (samples.size < minSamples) {
            return StabilityResult(bssid, samples.size, hasSufficientData = false, stabilityScore = 0.0)
        }

        val rssiValues = samples.map { it.rssi.toDouble() }
        val latencyValues = samples.mapNotNull { it.latencyMs }

        val stabilityRssi = 100.0 * (1.0 - normalizedStdDev(rssiValues, MAX_EXPECTED_RSSI_STDDEV))

        val stabilityScore = if (latencyValues.size >= minSamples) {
            val stabilityLatency = 100.0 * (1.0 - normalizedStdDev(latencyValues, MAX_EXPECTED_LATENCY_STDDEV))
            0.6 * stabilityRssi + 0.4 * stabilityLatency
        } else {
            stabilityRssi
        }

        return StabilityResult(
            bssid = bssid,
            sampleCount = samples.size,
            hasSufficientData = true,
            stabilityScore = stabilityScore.coerceIn(0.0, 100.0),
        )
    }

    /** Drops buffers for BSSIDs not present in [seenBssids] so long-gone APs don't linger. */
    @Synchronized
    fun pruneMissing(seenBssids: Set<String>) {
        buffers.keys.retainAll(seenBssids)
    }

    private fun normalizedStdDev(values: List<Double>, maxExpectedStdDev: Double): Double {
        val sd = stdDev(values)
        return (sd / maxExpectedStdDev).coerceIn(0.0, 1.0)
    }

    private fun stdDev(values: List<Double>): Double {
        if (values.size < 2) return 0.0
        val mean = values.average()
        val variance = values.sumOf { (it - mean) * (it - mean) } / values.size
        return sqrt(variance)
    }

    companion object {
        const val MAX_SAMPLES = 15
        const val MIN_SAMPLES = 5

        // Empirically reasonable ceilings for "fully unstable" — a BSSID whose RSSI or
        // latency swings by this much across the window scores 0 on that sub-term.
        const val MAX_EXPECTED_RSSI_STDDEV = 12.0 // dBm
        const val MAX_EXPECTED_LATENCY_STDDEV = 80.0 // ms
    }
}
