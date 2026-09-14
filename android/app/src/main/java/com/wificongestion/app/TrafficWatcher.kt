package com.wificongestion.app

import android.net.TrafficStats
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

class TrafficWatcher {

    private var job: Job? = null

    fun start(scope: CoroutineScope, thresholdBytes: Long, onSpike: () -> Unit) {
        stop()
        job = scope.launch(Dispatchers.Default) {
            var baseline = TrafficStats.getTotalRxBytes()
            while (true) {
                delay(2000)
                val current = TrafficStats.getTotalRxBytes()
                val delta = current - baseline
                baseline = current

                if (delta >= thresholdBytes) {
                    onSpike()
                }
            }
        }
    }

    fun stop() {
        job?.cancel()
        job = null
    }
}
