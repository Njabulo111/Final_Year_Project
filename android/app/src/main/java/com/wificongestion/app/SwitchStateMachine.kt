package com.wificongestion.app

/** MONITORING -> SWITCH_CANDIDATE -> COOLDOWN -> MONITORING. See class doc on [SwitchStateMachine]. */
enum class MonitorState { MONITORING, SWITCH_CANDIDATE, COOLDOWN }

/** One AP's scoring snapshot for a single cycle, as seen by the state machine. */
data class ApScoreSnapshot(
    val bssid: String,
    val ssid: String,
    val totalScore: Double,
    val stabilityScore: Double,
    val hasSufficientData: Boolean,
)

sealed class CycleResult {
    object NoAction : CycleResult()
    data class SwitchRecommended(val target: ApScoreSnapshot, val current: ApScoreSnapshot) : CycleResult()
}

/**
 * Drives when a switch recommendation fires, and — just as importantly — when it must NOT
 * fire again. A single bad scoring cycle (a momentary RSSI dip, one slow ping) must never
 * trigger a switch prompt; sustained degradation must.
 *
 * States:
 *  - MONITORING: normal operation. Watches the connected AP's stability; if it stays below
 *    [stabilityDegradedThreshold] for [sustainedCycles] consecutive cycles AND a candidate
 *    AP clears both the score margin and stability gap, transitions to SWITCH_CANDIDATE and
 *    emits the recommendation.
 *  - SWITCH_CANDIDATE: a recommendation has been surfaced to the user (there is no silent
 *    switch on Android — the platform always shows its own connect confirmation). The caller
 *    must report the outcome via [onUserAccepted] or [onUserDeclinedOrTimedOut]; both move to
 *    COOLDOWN so a declined prompt can't immediately re-fire.
 *  - COOLDOWN: all switch conditions are ignored until [cooldownMs] elapses, regardless of how
 *    the raw scores jitter in the meantime. This is what bounds both how often the radio is
 *    asked to hop and how often the user is interrupted.
 *
 * One instance should be kept alive for the lifetime of the monitoring loop (e.g. as a field
 * on `MonitorService`) — recreating it every cycle would reset [degradedStreak] and defeat the
 * sustained-cycle requirement.
 */
class SwitchStateMachine(
    private val stabilityDegradedThreshold: Double = 40.0,
    private val sustainedCycles: Int = 4,
    private val hysteresisMarginPct: Double = 20.0,
    private val minStabilityGap: Double = 15.0,
    private val cooldownMs: Long = 90_000L,
) {
    var state: MonitorState = MonitorState.MONITORING
        private set

    private var degradedStreak = 0
    private var cooldownUntil = 0L

    /**
     * Call once per scoring cycle with the connected AP's snapshot and every other
     * currently-visible AP's snapshot. No-ops (returns [CycleResult.NoAction]) while in
     * SWITCH_CANDIDATE (awaiting the caller's accept/decline) or COOLDOWN.
     */
    fun onCycle(
        current: ApScoreSnapshot,
        candidates: List<ApScoreSnapshot>,
        nowMs: Long = System.currentTimeMillis(),
    ): CycleResult {
        if (state == MonitorState.COOLDOWN) {
            if (nowMs < cooldownUntil) return CycleResult.NoAction
            state = MonitorState.MONITORING
        }

        if (state == MonitorState.SWITCH_CANDIDATE) return CycleResult.NoAction

        val degraded = current.hasSufficientData && current.stabilityScore < stabilityDegradedThreshold
        degradedStreak = if (degraded) degradedStreak + 1 else 0

        if (degradedStreak < sustainedCycles) return CycleResult.NoAction

        val best = candidates
            .filter { it.hasSufficientData && it.bssid != current.bssid }
            .maxByOrNull { it.totalScore }
            ?: return CycleResult.NoAction

        val clearsScoreMargin = best.totalScore >= current.totalScore * (1 + hysteresisMarginPct / 100.0)
        val clearsStabilityGap = best.stabilityScore >= current.stabilityScore + minStabilityGap

        if (!clearsScoreMargin || !clearsStabilityGap) return CycleResult.NoAction

        state = MonitorState.SWITCH_CANDIDATE
        return CycleResult.SwitchRecommended(target = best, current = current)
    }

    /** User accepted the system connect prompt and the switch completed (or was attempted). */
    fun onUserAccepted(nowMs: Long = System.currentTimeMillis()) = enterCooldown(nowMs)

    /** User declined, dismissed, or the confirmation prompt timed out unanswered. */
    fun onUserDeclinedOrTimedOut(nowMs: Long = System.currentTimeMillis()) = enterCooldown(nowMs)

    private fun enterCooldown(nowMs: Long) {
        state = MonitorState.COOLDOWN
        cooldownUntil = nowMs + cooldownMs
        degradedStreak = 0
    }
}
