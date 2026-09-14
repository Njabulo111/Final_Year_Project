package com.wificongestion.app

/**
 * Central scoring formulas for the AP-quality model.
 *
 * Revision history (kept here instead of silently overwritten, per the as-built-vs-designed
 * documentation rule — see also the dated `Weights` row this revision adds in the Excel
 * workbook):
 *   v1 (D1/D2 report): 0.35 signal + 0.30 latency + 0.20 loss + 0.15 stability
 *   v2 (this file):    0.25 signal + 0.25 latency + 0.15 loss + 0.15 stability + 0.20 SNR
 *     - stability is now a real per-AP time-series measure (see [ApHistoryTracker]),
 *       not a one-shot placeholder.
 *     - SNR is added as a 5th term because true SNR (signal-to-noise-floor) is not
 *       readable on modern Android without root; link-speed is used as a proxy instead.
 */
object ScoringEngine {

    const val WEIGHT_SIGNAL = 0.25
    const val WEIGHT_LATENCY = 0.25
    const val WEIGHT_LOSS = 0.15
    const val WEIGHT_STABILITY = 0.15
    const val WEIGHT_SNR = 0.20

    fun normalize(value: Double, min: Double, max: Double): Double =
        ((value - min) / (max - min) * 100).coerceIn(0.0, 100.0)

    fun signalScore(rssiDbm: Int): Double = normalize(rssiDbm.toDouble(), -90.0, -30.0)

    fun latencyScore(latencyMs: Double): Double = 100.0 - normalize(latencyMs, 0.0, 200.0)

    fun lossScore(packetLossPct: Double): Double = 100.0 - normalize(packetLossPct, 0.0, 20.0)

    /**
     * SNR proxy from link speed. The PHY generation (n/ac/ax) isn't reliably knowable from
     * `WifiInfo`, so link speed is normalized against a conservative per-band ceiling instead
     * of a standard-specific one. This is deliberately the "simple version" the design doc
     * calls for first — the RSSI-implied-vs-actual gap refinement is not implemented; add it
     * only if this proxy proves too noisy in field testing.
     */
    fun snrProxyScore(linkSpeedMbps: Int, is5GHzBand: Boolean): Double {
        val maxExpected = if (is5GHzBand) MAX_EXPECTED_LINK_SPEED_5GHZ else MAX_EXPECTED_LINK_SPEED_24GHZ
        return normalize(linkSpeedMbps.toDouble(), MIN_EXPECTED_LINK_SPEED, maxExpected)
    }

    /**
     * Estimated link speed for a BSSID Android has only scanned (never associated with),
     * so `WifiInfo.getLinkSpeed()` isn't available. Approximates the typical RSSI-to-PHY-rate
     * curve for 802.11n/ac/ax rather than leaving candidate APs without any SNR term at all.
     * Documented approximation, not a measured value — see class doc.
     */
    fun estimateLinkSpeedMbpsFromRssi(rssiDbm: Int, is5GHzBand: Boolean): Int {
        val ceiling = if (is5GHzBand) MAX_EXPECTED_LINK_SPEED_5GHZ else MAX_EXPECTED_LINK_SPEED_24GHZ
        val fraction = normalize(rssiDbm.toDouble(), -90.0, -35.0) / 100.0
        return (MIN_EXPECTED_LINK_SPEED + fraction * (ceiling - MIN_EXPECTED_LINK_SPEED)).toInt()
    }

    fun isFiveGHzBand(frequencyMHz: Int): Boolean = frequencyMHz >= 5000

    data class ScoreBreakdown(
        val signalScore: Double,
        val latencyScore: Double,
        val lossScore: Double,
        val stabilityScore: Double,
        val snrProxyScore: Double,
        val totalScore: Double,
    )

    fun composite(
        rssiDbm: Int,
        latencyMs: Double,
        packetLossPct: Double,
        stabilityScore: Double,
        linkSpeedMbps: Int,
        is5GHzBand: Boolean,
        weights: Map<String, Double> = defaultWeights(),
    ): ScoreBreakdown {
        val signal = signalScore(rssiDbm)
        val latency = latencyScore(latencyMs)
        val loss = lossScore(packetLossPct)
        val snr = snrProxyScore(linkSpeedMbps, is5GHzBand)

        val total = signal * (weights["signal"] ?: WEIGHT_SIGNAL) +
            latency * (weights["latency"] ?: WEIGHT_LATENCY) +
            loss * (weights["loss"] ?: WEIGHT_LOSS) +
            stabilityScore * (weights["stability"] ?: WEIGHT_STABILITY) +
            snr * (weights["snr"] ?: WEIGHT_SNR)

        return ScoreBreakdown(signal, latency, loss, stabilityScore, snr, total)
    }

    /**
     * Score for an AP Android has only scanned, never associated with — latency and packet
     * loss cannot be measured without connecting to it, so this uses only the terms that
     * genuinely can be observed pre-connect (signal, stability, SNR proxy), re-normalized
     * to their share of the full weight so the result stays comparable on the same 0-100
     * scale as [composite]'s totalScore. Deliberately does not fabricate latency/loss
     * numbers for an AP the device has never touched.
     */
    fun candidateScore(
        rssiDbm: Int,
        stabilityScore: Double,
        linkSpeedMbps: Int,
        is5GHzBand: Boolean,
        weights: Map<String, Double> = defaultWeights(),
    ): Double {
        val signal = signalScore(rssiDbm)
        val snr = snrProxyScore(linkSpeedMbps, is5GHzBand)
        val wSignal = weights["signal"] ?: WEIGHT_SIGNAL
        val wStability = weights["stability"] ?: WEIGHT_STABILITY
        val wSnr = weights["snr"] ?: WEIGHT_SNR
        val availableWeight = wSignal + wStability + wSnr
        if (availableWeight <= 0.0) return 0.0
        val raw = signal * wSignal + stabilityScore * wStability + snr * wSnr
        return raw / availableWeight
    }

    fun defaultWeights(): Map<String, Double> = mapOf(
        "signal" to WEIGHT_SIGNAL,
        "latency" to WEIGHT_LATENCY,
        "loss" to WEIGHT_LOSS,
        "stability" to WEIGHT_STABILITY,
        "snr" to WEIGHT_SNR,
    )

    private const val MIN_EXPECTED_LINK_SPEED = 1.0
    private const val MAX_EXPECTED_LINK_SPEED_24GHZ = 150.0 // 802.11n single-stream ceiling
    private const val MAX_EXPECTED_LINK_SPEED_5GHZ = 866.0 // 802.11ac single-stream (VHT80) ceiling
}
