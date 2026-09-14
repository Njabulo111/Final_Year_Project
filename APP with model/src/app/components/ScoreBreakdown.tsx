import { motion } from 'motion/react';

interface SubScore {
  label: string;
  value: number;
  weight: number;
  color: string;
}

interface ScoreBreakdownProps {
  subScores: SubScore[];
  totalScore: number;
}

export function ScoreBreakdown({ subScores, totalScore }: ScoreBreakdownProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between mb-6">
        <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))]">
          Score Breakdown
        </h3>
        <div className="text-3xl font-bold text-[rgb(var(--color-primary))]">
          {totalScore}
        </div>
      </div>

      <div className="space-y-4">
        {subScores.map((score, index) => (
          <motion.div
            key={score.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[rgb(var(--color-foreground))]">
                  {score.label}
                </span>
                <span className="text-xs text-[rgb(var(--color-foreground))] opacity-50">
                  (Weight: {(score.weight * 100).toFixed(0)}%)
                </span>
              </div>
              <span className="text-sm font-semibold text-[rgb(var(--color-foreground))]">
                {score.value.toFixed(1)}
              </span>
            </div>

            <div className="relative h-3 bg-[rgb(var(--color-muted))] rounded-full overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: score.color }}
                initial={{ width: 0 }}
                animate={{ width: `${score.value}%` }}
                transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-[rgb(var(--color-muted))] rounded-lg">
        <div className="text-xs text-[rgb(var(--color-foreground))] opacity-70 space-y-1">
          <div>Score = (Signal × {(subScores[0]?.weight * 100).toFixed(0)}%) + (Latency × {(subScores[1]?.weight * 100).toFixed(0)}%) + </div>
          <div className="ml-16">(Loss × {(subScores[2]?.weight * 100).toFixed(0)}%) + (Stability × {(subScores[3]?.weight * 100).toFixed(0)}%)</div>
        </div>
      </div>
    </div>
  );
}
