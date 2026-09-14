import { AccessPoint } from '../types/wifi';
import { Wifi, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';

interface RadialAPMapProps {
  accessPoints: AccessPoint[];
  selectedAP?: string;
  onSelectAP?: (ap: AccessPoint) => void;
  size?: number;
}

export function RadialAPMap({ accessPoints, selectedAP, onSelectAP, size = 400 }: RadialAPMapProps) {
  const centerX = size / 2;
  const centerY = size / 2;
  const maxRadius = size * 0.4;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      case 'poor': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getSignalRings = () => {
    return [0.25, 0.5, 0.75, 1].map((factor, index) => (
      <circle
        key={index}
        cx={centerX}
        cy={centerY}
        r={maxRadius * factor}
        fill="none"
        stroke="rgb(var(--color-border) / 0.2)"
        strokeWidth="1"
        strokeDasharray={index === 3 ? 'none' : '4 4'}
      />
    ));
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0">
        <defs>
          <radialGradient id="signalGradient">
            <stop offset="0%" stopColor="rgb(var(--color-primary) / 0.1)" />
            <stop offset="100%" stopColor="rgb(var(--color-primary) / 0)" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <circle
          cx={centerX}
          cy={centerY}
          r={maxRadius}
          fill="url(#signalGradient)"
        />

        {getSignalRings()}

        <g>
          {accessPoints.map((ap) => {
            const angle = (ap.position.angle * Math.PI) / 180;
            const radius = ap.position.distance * maxRadius;
            const x = centerX + radius * Math.cos(angle - Math.PI / 2);
            const y = centerY + radius * Math.sin(angle - Math.PI / 2);

            const isSelected = selectedAP === ap.id;
            const isConnected = ap.isConnected;

            return (
              <g key={ap.id}>
                <motion.circle
                  cx={x}
                  cy={y}
                  r={isConnected ? 32 : 24}
                  fill={getStatusColor(ap.status)}
                  fillOpacity={0.15}
                  initial={{ scale: 0 }}
                  animate={{
                    scale: isSelected ? 1.3 : 1,
                    opacity: [1, 0.6, 1],
                  }}
                  transition={{
                    scale: { duration: 0.3 },
                    opacity: { duration: 2, repeat: Infinity }
                  }}
                />

                {isConnected && (
                  <>
                    <motion.circle
                      cx={x}
                      cy={y}
                      r={40}
                      fill="none"
                      stroke={getStatusColor(ap.status)}
                      strokeWidth="2"
                      strokeOpacity={0.4}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{
                        scale: [1, 1.5],
                        opacity: [0.6, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut"
                      }}
                    />
                    <motion.circle
                      cx={x}
                      cy={y}
                      r={40}
                      fill="none"
                      stroke={getStatusColor(ap.status)}
                      strokeWidth="2"
                      strokeOpacity={0.4}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{
                        scale: [1, 1.5],
                        opacity: [0.6, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeOut",
                        delay: 1
                      }}
                    />
                  </>
                )}

                <line
                  x1={centerX}
                  y1={centerY}
                  x2={x}
                  y2={y}
                  stroke={getStatusColor(ap.status)}
                  strokeWidth={isConnected ? 3 : 1}
                  strokeOpacity={isConnected ? 0.4 : 0.2}
                  strokeDasharray={isConnected ? 'none' : '2 2'}
                />

                <circle
                  cx={x}
                  cy={y}
                  r={isSelected ? 20 : 16}
                  fill={getStatusColor(ap.status)}
                  stroke="white"
                  strokeWidth={isSelected ? 3 : 2}
                  filter={isSelected ? 'url(#glow)' : 'none'}
                  className="cursor-pointer transition-all"
                  onClick={() => onSelectAP?.(ap)}
                />

                {ap.status === 'poor' ? (
                  <WifiOff
                    size={isSelected ? 12 : 10}
                    color="white"
                    x={x - (isSelected ? 6 : 5)}
                    y={y - (isSelected ? 6 : 5)}
                    className="pointer-events-none"
                  />
                ) : (
                  <Wifi
                    size={isSelected ? 12 : 10}
                    color="white"
                    x={x - (isSelected ? 6 : 5)}
                    y={y - (isSelected ? 6 : 5)}
                    className="pointer-events-none"
                  />
                )}
              </g>
            );
          })}
        </g>

        <circle
          cx={centerX}
          cy={centerY}
          r={8}
          fill="rgb(var(--color-primary))"
          stroke="white"
          strokeWidth="2"
        />
        <text
          x={centerX}
          y={centerY + 25}
          textAnchor="middle"
          className="text-xs fill-[rgb(var(--color-foreground))] font-medium"
        >
          You
        </text>
      </svg>

      <div className="absolute bottom-0 right-0 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-3 text-xs">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#10b981]" />
            <span className="text-[rgb(var(--color-foreground))]">Excellent (≥85)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#3b82f6]" />
            <span className="text-[rgb(var(--color-foreground))]">Good (70-84)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#f59e0b]" />
            <span className="text-[rgb(var(--color-foreground))]">Fair (50-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
            <span className="text-[rgb(var(--color-foreground))]">Poor (<50)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
