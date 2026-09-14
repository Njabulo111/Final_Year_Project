import { X, Code, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AccessPoint, Config } from '../types/wifi';

interface ScoringPanelProps {
  isOpen: boolean;
  onClose: () => void;
  accessPoint: AccessPoint | null;
  config: Config;
}

export function ScoringPanel({ isOpen, onClose, accessPoint, config }: ScoringPanelProps) {
  if (!accessPoint) return null;

  const rawInputs = {
    signal: accessPoint.signal,
    latency: accessPoint.latency,
    packetLoss: accessPoint.packetLoss,
    stability: accessPoint.stability,
  };

  const normalizedScores = {
    signal: accessPoint.subScores.signal,
    latency: accessPoint.subScores.latency,
    loss: accessPoint.subScores.loss,
    stability: accessPoint.subScores.stability,
  };

  const normalizationSteps = [
    {
      metric: 'Signal',
      raw: `${rawInputs.signal.toFixed(1)} dBm`,
      formula: `((${rawInputs.signal.toFixed(1)} - ${config.normalization.signalMin}) / (${config.normalization.signalMax} - ${config.normalization.signalMin})) × 100`,
      normalized: normalizedScores.signal.toFixed(2),
      weight: config.weights.signal,
      contribution: (normalizedScores.signal * config.weights.signal).toFixed(2),
    },
    {
      metric: 'Latency',
      raw: `${rawInputs.latency.toFixed(1)} ms`,
      formula: `100 - ((${rawInputs.latency.toFixed(1)} / ${config.normalization.latencyMax}) × 100)`,
      normalized: normalizedScores.latency.toFixed(2),
      weight: config.weights.latency,
      contribution: (normalizedScores.latency * config.weights.latency).toFixed(2),
    },
    {
      metric: 'Packet Loss',
      raw: `${rawInputs.packetLoss.toFixed(2)}%`,
      formula: `100 - ((${rawInputs.packetLoss.toFixed(2)} / ${config.normalization.lossMax}) × 100)`,
      normalized: normalizedScores.loss.toFixed(2),
      weight: config.weights.loss,
      contribution: (normalizedScores.loss * config.weights.loss).toFixed(2),
    },
    {
      metric: 'Stability',
      raw: `${rawInputs.stability.toFixed(1)}%`,
      formula: `${rawInputs.stability.toFixed(1)} (already normalized)`,
      normalized: normalizedScores.stability.toFixed(2),
      weight: config.weights.stability,
      contribution: (normalizedScores.stability * config.weights.stability).toFixed(2),
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-[rgb(var(--color-background))] shadow-2xl z-50 overflow-y-auto"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="sticky top-0 bg-[rgb(var(--color-background))] border-b border-[rgb(var(--color-border))] z-10">
              <div className="flex items-center justify-between p-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/10 rounded-lg">
                    <Code className="text-blue-600" size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[rgb(var(--color-foreground))]">
                      Scoring Algorithm
                    </h2>
                    <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
                      {accessPoint.ssid} - Transparent calculation
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-[rgb(var(--color-muted))] rounded-lg transition-colors"
                >
                  <X size={24} className="text-[rgb(var(--color-foreground))]" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-8">
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Info size={18} className="text-blue-600" />
                  <h3 className="font-semibold text-[rgb(var(--color-foreground))]">
                    Final Score
                  </h3>
                </div>
                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-bold text-blue-600">
                    {accessPoint.score}
                  </span>
                  <span className="text-xl text-[rgb(var(--color-foreground))] opacity-50">
                    / 100
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
                  Scoring Formula
                </h3>
                <div className="bg-[rgb(var(--color-muted))] rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  <div className="text-[rgb(var(--color-foreground))]">
                    <div className="text-blue-600 mb-2"># Weighted Score Calculation</div>
                    <div>Score = (</div>
                    <div className="ml-4">normalized_signal × {(config.weights.signal * 100).toFixed(0)}% +</div>
                    <div className="ml-4">normalized_latency × {(config.weights.latency * 100).toFixed(0)}% +</div>
                    <div className="ml-4">normalized_loss × {(config.weights.loss * 100).toFixed(0)}% +</div>
                    <div className="ml-4">normalized_stability × {(config.weights.stability * 100).toFixed(0)}%</div>
                    <div>)</div>
                    <div className="mt-4 text-green-600">
                      # Result: {accessPoint.score}/100
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
                  Normalized Sub-Scores
                </h3>
                <div className="space-y-6">
                  {normalizationSteps.map((step, index) => (
                    <motion.div
                      key={step.metric}
                      className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-4"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-[rgb(var(--color-foreground))]">
                          {step.metric}
                        </h4>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
                            {step.contribution}
                          </div>
                          <div className="text-xs text-[rgb(var(--color-foreground))] opacity-50">
                            contribution
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[rgb(var(--color-foreground))] opacity-70">
                            Raw Input:
                          </span>
                          <span className="font-mono font-semibold text-[rgb(var(--color-foreground))]">
                            {step.raw}
                          </span>
                        </div>

                        <div className="bg-[rgb(var(--color-muted))] rounded p-2 text-xs font-mono text-[rgb(var(--color-foreground))] overflow-x-auto">
                          {step.formula}
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[rgb(var(--color-foreground))] opacity-70">
                            Normalized:
                          </span>
                          <span className="font-mono font-semibold text-blue-600">
                            {step.normalized}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[rgb(var(--color-foreground))] opacity-70">
                            Weight:
                          </span>
                          <span className="font-semibold text-[rgb(var(--color-foreground))]">
                            ×{(step.weight * 100).toFixed(0)}%
                          </span>
                        </div>

                        <div className="relative h-3 bg-[rgb(var(--color-muted))] rounded-full overflow-hidden">
                          <motion.div
                            className="absolute inset-y-0 left-0 bg-blue-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${step.normalized}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
                  Normalization Reference Table
                </h3>
                <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-[rgb(var(--color-muted))]">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold text-[rgb(var(--color-foreground))]">
                          Parameter
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-[rgb(var(--color-foreground))]">
                          Min
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-[rgb(var(--color-foreground))]">
                          Max
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-[rgb(var(--color-foreground))]">
                          Unit
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[rgb(var(--color-border))]">
                      <tr>
                        <td className="px-4 py-3 font-medium text-[rgb(var(--color-foreground))]">Signal</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.signalMin}
                        </td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.signalMax}
                        </td>
                        <td className="px-4 py-3 text-[rgb(var(--color-foreground))] opacity-70">dBm</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-[rgb(var(--color-foreground))]">Latency</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.latencyMin}
                        </td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.latencyMax}
                        </td>
                        <td className="px-4 py-3 text-[rgb(var(--color-foreground))] opacity-70">ms</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-[rgb(var(--color-foreground))]">Packet Loss</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">0</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.lossMax}
                        </td>
                        <td className="px-4 py-3 text-[rgb(var(--color-foreground))] opacity-70">%</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 font-medium text-[rgb(var(--color-foreground))]">Stability Window</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">—</td>
                        <td className="px-4 py-3 font-mono text-[rgb(var(--color-foreground))]">
                          {config.normalization.stabilityWindow}
                        </td>
                        <td className="px-4 py-3 text-[rgb(var(--color-foreground))] opacity-70">seconds</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
                    All raw metrics are normalized to a 0-100 scale before applying weights.
                    The final score is the weighted sum of normalized sub-scores, ensuring
                    consistency across different metric ranges.
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
