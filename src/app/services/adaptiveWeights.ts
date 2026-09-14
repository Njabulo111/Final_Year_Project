import { AccessPoint, Config } from '../types/wifi';
import { loadConfig, saveConfig } from './settingsStorage';
import { WifiMonitor, isNative } from './nativeWifi';

type WeightKey = keyof Config['weights'];

function dominantMetric(current: AccessPoint, recommended: AccessPoint): WeightKey {
  const deltas: Record<WeightKey, number> = {
    signal: recommended.subScores.signal - current.subScores.signal,
    latency: recommended.subScores.latency - current.subScores.latency,
    loss: recommended.subScores.loss - current.subScores.loss,
    stability: recommended.subScores.stability - current.subScores.stability,
  };
  return (Object.keys(deltas) as WeightKey[]).reduce((a, b) => (deltas[a] >= deltas[b] ? a : b));
}

function nudgeWeight(weights: Config['weights'], key: WeightKey, delta: number): Config['weights'] {
  const next = { ...weights, [key]: Math.max(0.05, weights[key] + delta) };
  const sum = Object.values(next).reduce((s, w) => s + w, 0);
  (Object.keys(next) as WeightKey[]).forEach((k) => {
    next[k] = next[k] / sum;
  });
  return next;
}

export function scheduleAdaptiveWeightCheck(current: AccessPoint, recommended: AccessPoint, delayMs = 30000): void {
  if (!isNative()) return;

  const metric = dominantMetric(current, recommended);

  window.setTimeout(async () => {
    const config = loadConfig();
    if (!config.features.adaptiveScoring) return;

    try {
      const result = await WifiMonitor.testNetwork();
      const improved =
        metric === 'latency'
          ? result.latencyMs < current.latency
          : metric === 'loss'
            ? result.packetLossPct < current.packetLoss
            : true;

      const delta = improved ? 0.01 : -0.01;
      const nextWeights = nudgeWeight(config.weights, metric, delta);
      saveConfig({ ...config, weights: nextWeights });
      void WifiMonitor.updateResearchWeight({
        metric,
        weight: nextWeights[metric],
        notes: 'Post-switch nudge from scheduleAdaptiveWeightCheck',
      }).catch(() => undefined);
    } catch (error) {
      console.warn('Adaptive weight check failed:', error);
    }
  }, delayMs);
}

const METRIC_KEYS: WeightKey[] = ['signal', 'latency', 'loss', 'stability'];

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Recalibrates scoring weights from accumulated on-device scan history instead of a
 * single post-switch sample: whichever sub-metric best separates the top-quartile
 * scoring scans from the bottom-quartile ones (i.e. correlates most with a good
 * connection) gets nudged up slightly, renormalized to sum to 1.
 */
export async function recalibrateWeightsFromHistory(): Promise<void> {
  if (!isNative()) return;

  const config = loadConfig();
  if (!config.features.adaptiveScoring) return;

  try {
    const { rows } = await WifiMonitor.getScanHistorySample({ limit: 200 });
    if (rows.length < 20) return;

    const sorted = [...rows].sort((a, b) => a.totalScore - b.totalScore);
    const quartileSize = Math.max(1, Math.floor(sorted.length / 4));
    const bottomQuartile = sorted.slice(0, quartileSize);
    const topQuartile = sorted.slice(-quartileSize);

    const separations: Record<WeightKey, number> = {
      signal: average(topQuartile.map((r) => r.signalScore)) - average(bottomQuartile.map((r) => r.signalScore)),
      latency: average(topQuartile.map((r) => r.latencyScore)) - average(bottomQuartile.map((r) => r.latencyScore)),
      loss: average(topQuartile.map((r) => r.lossScore)) - average(bottomQuartile.map((r) => r.lossScore)),
      stability: average(topQuartile.map((r) => r.stabilityScore)) - average(bottomQuartile.map((r) => r.stabilityScore)),
    };

    const dominant = METRIC_KEYS.reduce((a, b) => (separations[a] >= separations[b] ? a : b));
    if (separations[dominant] <= 0) return;

    const nextWeights = nudgeWeight(config.weights, dominant, 0.01);
    saveConfig({ ...config, weights: nextWeights });

    await Promise.all(
      METRIC_KEYS.map((key) =>
        WifiMonitor.updateResearchWeight({
          metric: key,
          weight: nextWeights[key],
          notes: `Recalibrated from ${rows.length}-sample scan history (dominant: ${dominant})`,
        }).catch(() => undefined),
      ),
    );
  } catch (error) {
    console.warn('Weight recalibration failed:', error);
  }
}
