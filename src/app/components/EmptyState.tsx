import { WifiOff, Lock, AlertTriangle, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

export type EmptyStateVariant = 'no-networks' | 'permission-denied' | 'scan-failed';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  onRetry?: () => void;
}

const variantContent = {
  'no-networks': {
    icon: WifiOff,
    title: 'No networks detected',
    body: 'Turn on WiFi to start scanning nearby access points.',
    actionLabel: 'Try Again',
  },
  'permission-denied': {
    icon: Lock,
    title: 'Location permission needed',
    body: 'Location permission is required to scan WiFi networks. Enable it for this app and try again.',
    actionLabel: 'Try Again',
  },
  'scan-failed': {
    icon: AlertTriangle,
    title: "Scan didn't complete",
    body: 'Try again.',
    actionLabel: 'Retry',
  },
} as const;

export function EmptyState({ variant = 'no-networks', onRetry }: EmptyStateProps) {
  const { icon: Icon, title, body, actionLabel } = variantContent[variant];

  return (
    <div className="flex min-h-[500px] items-center justify-center">
      <motion.div
        className="w-full max-w-sm space-y-5 text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <Icon size={36} className="text-muted-foreground" />
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>

        {onRetry && (
          <motion.button
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-signal px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
          >
            <RefreshCw size={16} />
            {actionLabel}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}
