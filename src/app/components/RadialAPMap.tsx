import { AccessPoint, Coordinates } from '../types/wifi';
import { Wifi, WifiOff } from 'lucide-react';
import { motion } from 'motion/react';

interface RadialAPMapProps {
  accessPoints: AccessPoint[];
  selectedAP?: string;
  onSelectAP?: (ap: AccessPoint) => void;
  size?: number;
  userLocation?: Coordinates | null;
  prevLocation?: Coordinates | null;
}

export function RadialAPMap({ accessPoints, selectedAP, onSelectAP, size = 400, userLocation, prevLocation }: RadialAPMapProps) {
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

  const getSignalOpacity = (quality: number) => {
    return Math.min(0.9, Math.max(0.25, 0.25 + (quality / 100) * 0.6));
  };

  const getDotSize = (quality: number, selected: boolean) => {
    return (selected ? 24 : 18) + (quality / 100) * 8;
  };

  const getLineStrokeWidth = (quality: number, connected: boolean) => {
    return connected ? 3 : Math.max(1, 1 + (quality / 100) * 2);
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
            <stop offset="0%" stopColor="#eef2ff" stopOpacity="0.75" />
            <stop offset="60%" stopColor="#f8fafc" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M0,0 L8,3 L0,6 Z" fill="currentColor" />
          </marker>
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
            const signalOpacity = getSignalOpacity(ap.signalQuality);
            const dotSize = getDotSize(ap.signalQuality, isSelected);
            const lineWidth = getLineStrokeWidth(ap.signalQuality, isConnected);
            const fillColor = getStatusColor(ap.status);

            return (
              <g key={ap.id}>
                <motion.circle
                  cx={x}
                  cy={y}
                  r={dotSize + (isConnected ? 8 : 4)}
                  fill={fillColor}
                  fillOpacity={signalOpacity}
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
                  stroke={fillColor}
                  strokeWidth={lineWidth}
                  strokeOpacity={isConnected ? 0.5 : Math.min(0.45, 0.2 + signalOpacity / 2)}
                  strokeDasharray={isConnected ? 'none' : '2 2'}
                  markerEnd="url(#arrowhead)"
                  style={{ color: fillColor }}
                />

                <circle
                  cx={x}
                  cy={y}
                  r={dotSize}
                  fill={fillColor}
                  stroke="white"
                  strokeWidth={isSelected ? 3 : 2}
                  filter={isSelected ? 'url(#glow)' : 'none'}
                  className="cursor-pointer transition-all"
                  onClick={() => onSelectAP?.(ap)}
                />

                {isSelected && (
                  <text
                    x={x}
                    y={y - dotSize - 10}
                    textAnchor="middle"
                    className="text-xs fill-[rgb(var(--color-foreground))] font-bold"
                  >
                    {ap.ip}
                  </text>
                )}

                {/* Always show label with IP address */}
                <text
                  x={x + dotSize + 8}
                  y={y + 4}
                  className="text-xs fill-[rgb(var(--color-foreground))] opacity-95 font-bold pointer-events-none"
                >
                  {ap.ip}
                </text>

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

        {/* Draw live movement arrow from previous location to current (only when movement > threshold) */}
        {userLocation && prevLocation && (function() {
          const toRadians = (deg: number) => deg * Math.PI / 180;
          const haversineMeters = (a: {latitude:number, longitude:number}, b: {latitude:number, longitude:number}) => {
            const R = 6371000; // meters
            const dLat = toRadians(b.latitude - a.latitude);
            const dLon = toRadians(b.longitude - a.longitude);
            const lat1 = toRadians(a.latitude);
            const lat2 = toRadians(b.latitude);
            const sinDLat = Math.sin(dLat/2);
            const sinDLon = Math.sin(dLon/2);
            const aa = sinDLat*sinDLat + Math.cos(lat1)*Math.cos(lat2)*sinDLon*sinDLon;
            const cc = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
            return R * cc;
          };

          const bearingRad = (function(a: {latitude:number, longitude:number}, b: {latitude:number, longitude:number}){
            const lat1 = toRadians(a.latitude);
            const lat2 = toRadians(b.latitude);
            const dLon = toRadians(b.longitude - a.longitude);
            const y = Math.sin(dLon) * Math.cos(lat2);
            const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            return (Math.atan2(y, x) + 2*Math.PI) % (2*Math.PI);
          })(prevLocation, userLocation);

          const distM = haversineMeters(prevLocation, userLocation);
          const minDistToShow = 2; // meters
          if (distM < minDistToShow) return null;

          const arrowLen = Math.min(140, Math.max(24, distM * 0.75));
          const angleScreen = bearingRad - Math.PI / 2;
          const endX = centerX + arrowLen * Math.cos(angleScreen);
          const endY = centerY + arrowLen * Math.sin(angleScreen);

          return (
            <g>
              <line
                x1={centerX}
                y1={centerY}
                x2={endX}
                y2={endY}
                stroke="#2563eb"
                strokeWidth={2}
                strokeOpacity={0.98}
                markerEnd="url(#arrowhead)"
              />
              <circle cx={endX} cy={endY} r={4} fill="#2563eb" />
            </g>
          );
        })()}

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
            <span className="text-[rgb(var(--color-foreground))]">Poor (&lt;50)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
