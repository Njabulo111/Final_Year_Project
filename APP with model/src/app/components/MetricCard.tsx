import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'motion/react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  color?: 'green' | 'blue' | 'orange' | 'red';
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  color = 'blue'
}: MetricCardProps) {
  const colorClasses = {
    green: 'bg-green-500/10 text-green-600',
    blue: 'bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-600',
    red: 'bg-red-500/10 text-red-600',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-500';

  return (
    <motion.div
      className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, shadow: '0 10px 30px rgba(0,0,0,0.1)' }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon size={16} />
            {trendValue && <span className="text-sm font-medium">{trendValue}</span>}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h3 className="text-sm font-medium text-[rgb(var(--color-foreground))] opacity-70">
          {title}
        </h3>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-[rgb(var(--color-foreground))]">
            {value}
          </span>
          {unit && (
            <span className="text-sm text-[rgb(var(--color-foreground))] opacity-50">
              {unit}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
