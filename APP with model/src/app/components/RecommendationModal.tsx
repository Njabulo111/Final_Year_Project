import { X, ArrowRight, CheckCircle2, TrendingUp, Wifi, Timer, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AccessPoint, Config } from '../types/wifi';

interface RecommendationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentAP: AccessPoint | null;
  recommendedAP: AccessPoint | null;
  config: Config;
}

export function RecommendationModal({
  isOpen,
  onClose,
  currentAP,
  recommendedAP,
  config,
}: RecommendationModalProps) {
  if (!currentAP || !recommendedAP) return null;

  const scoreDiff = recommendedAP.score - currentAP.score;
  const reasons = [];

  if (recommendedAP.signal > currentAP.signal) {
    reasons.push({
      icon: Wifi,
      text: `Stronger signal: ${recommendedAP.signal.toFixed(0)}dBm vs ${currentAP.signal.toFixed(0)}dBm (${(recommendedAP.signal - currentAP.signal).toFixed(1)}dBm improvement)`,
    });
  }

  if (recommendedAP.latency < currentAP.latency) {
    reasons.push({
      icon: Timer,
      text: `Lower latency: ${recommendedAP.latency.toFixed(1)}ms vs ${currentAP.latency.toFixed(1)}ms (${(currentAP.latency - recommendedAP.latency).toFixed(1)}ms faster)`,
    });
  }

  if (recommendedAP.packetLoss < currentAP.packetLoss) {
    reasons.push({
      icon: TrendingUp,
      text: `Less packet loss: ${recommendedAP.packetLoss.toFixed(2)}% vs ${currentAP.packetLoss.toFixed(2)}% (${(currentAP.packetLoss - recommendedAP.packetLoss).toFixed(2)}% reduction)`,
    });
  }

  if (recommendedAP.stability > currentAP.stability) {
    reasons.push({
      icon: CheckCircle2,
      text: `More stable: ${recommendedAP.stability.toFixed(0)}% vs ${currentAP.stability.toFixed(0)}% (${(recommendedAP.stability - currentAP.stability).toFixed(0)}% improvement)`,
    });
  }

  const APCard = ({ ap, label, isCurrent }: { ap: AccessPoint; label: string; isCurrent: boolean }) => (
    <div className={`flex-1 bg-[rgb(var(--color-background))] border-2 rounded-xl p-6 ${
      isCurrent ? 'border-[rgb(var(--color-border))]' : 'border-green-500'
    }`}>
      <div className="flex items-center justify-between mb-4">
        <span className={`text-sm font-semibold ${
          isCurrent ? 'text-[rgb(var(--color-foreground))] opacity-70' : 'text-green-600'
        }`}>
          {label}
        </span>
        {!isCurrent && (
          <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded">
            RECOMMENDED
          </span>
        )}
      </div>

      <h3 className="text-xl font-bold text-[rgb(var(--color-foreground))] mb-6">
        {ap.ssid}
      </h3>

      <div className="space-y-4">
        <div className="text-center py-6 bg-[rgb(var(--color-muted))] rounded-lg">
          <div className="text-sm text-[rgb(var(--color-foreground))] opacity-70 mb-2">
            Overall Score
          </div>
          <div className={`text-5xl font-bold ${
            isCurrent ? 'text-[rgb(var(--color-foreground))]' : 'text-green-600'
          }`}>
            {ap.score}
          </div>
          <div className="text-sm text-[rgb(var(--color-foreground))] opacity-50 mt-1">
            / 100
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Signal:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.signal.toFixed(0)} dBm
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Latency:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.latency.toFixed(1)} ms
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Packet Loss:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.packetLoss.toFixed(2)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Stability:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.stability.toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Channel:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.channel}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[rgb(var(--color-foreground))] opacity-70">Frequency:</span>
            <span className="font-semibold text-[rgb(var(--color-foreground))]">
              {ap.frequency} MHz
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-[rgb(var(--color-border))]">
          <div className="text-xs text-[rgb(var(--color-foreground))] opacity-50 mb-2">
            Score Breakdown
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Signal', value: ap.subScores.signal, color: '#10b981' },
              { label: 'Latency', value: ap.subScores.latency, color: '#3b82f6' },
              { label: 'Loss', value: ap.subScores.loss, color: '#f59e0b' },
              { label: 'Stability', value: ap.subScores.stability, color: '#8b5cf6' },
            ].map((sub) => (
              <div key={sub.label} className="text-center">
                <div className="text-xs text-[rgb(var(--color-foreground))] opacity-70 mb-1">
                  {sub.label}
                </div>
                <div className="font-bold text-[rgb(var(--color-foreground))]">
                  {sub.value.toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          >
            <motion.div
              className="bg-[rgb(var(--color-background))] rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-[rgb(var(--color-background))] border-b border-[rgb(var(--color-border))] z-10 rounded-t-2xl">
                <div className="flex items-center justify-between p-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-lg">
                      <AlertTriangle className="text-orange-600" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[rgb(var(--color-foreground))]">
                        Better Access Point Available
                      </h2>
                      <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
                        Switching recommendation based on performance analysis
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

              <div className="p-6 space-y-6">
                <div className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border border-green-500/20 rounded-xl p-6">
                  <div className="flex items-center justify-center gap-4">
                    <div className="text-center">
                      <div className="text-sm text-[rgb(var(--color-foreground))] opacity-70 mb-1">
                        Score Improvement
                      </div>
                      <div className="text-4xl font-bold text-green-600">
                        +{scoreDiff.toFixed(0)}
                      </div>
                      <div className="text-xs text-[rgb(var(--color-foreground))] opacity-50 mt-1">
                        points
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-6 items-center">
                  <APCard ap={currentAP} label="CURRENT" isCurrent={true} />

                  <div className="flex-shrink-0">
                    <div className="p-4 bg-blue-500/10 rounded-full">
                      <ArrowRight size={32} className="text-blue-600" />
                    </div>
                  </div>

                  <APCard ap={recommendedAP} label="RECOMMENDED" isCurrent={false} />
                </div>

                <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
                    Why Switch?
                  </h3>
                  <div className="space-y-3">
                    {reasons.map((reason, index) => {
                      const Icon = reason.icon;
                      return (
                        <motion.div
                          key={index}
                          className="flex items-start gap-3"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                        >
                          <div className="p-2 bg-green-500/10 rounded-lg flex-shrink-0">
                            <Icon size={18} className="text-green-600" />
                          </div>
                          <p className="text-sm text-[rgb(var(--color-foreground))] pt-2">
                            {reason.text}
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 text-sm text-[rgb(var(--color-foreground))] opacity-70">
                      <p>
                        <strong className="text-[rgb(var(--color-foreground))] opacity-100">
                          20-Point Threshold Rule:
                        </strong>{' '}
                        Recommendations are only shown when the score difference exceeds{' '}
                        {config.thresholds.recommendationThreshold} points to avoid frequent
                        unnecessary switches.
                      </p>
                      <p>
                        Current difference: <strong className="text-green-600">{scoreDiff.toFixed(0)} points</strong>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
