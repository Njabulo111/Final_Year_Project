import { useState, useEffect } from 'react';
import { RadialAPMap } from '../components/RadialAPMap';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { ScoringPanel } from '../components/ScoringPanel';
import { RecommendationModal } from '../components/RecommendationModal';
import { EmptyState } from '../components/EmptyState';
import { Wifi, Activity, AlertTriangle, CheckCircle2, Code, Signal, Clock3 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'motion/react';
import { AccessPoint, Config } from '../types/wifi';
import { generateMockAPs } from '../utils/mockData';
import { getLatestData, mapBackendAps } from '../services/apiClient';
import { loadConfig } from '../services/settingsStorage';
import { maybeNotifyCongestion } from '../services/notifications';
import { WifiMonitor, isNative } from '../services/nativeWifi';

function SignalBars({ scanning }: { scanning: boolean }) {
  const bars = [18, 28, 38, 48];
  return (
    <div className="flex items-end gap-1.5">
      {bars.map((height, index) => (
        <motion.span
          key={height}
          className="block w-1.5 rounded-full bg-emerald-400/90"
          animate={{
            height: scanning ? [height, height + 6, height] : height,
            opacity: scanning ? [0.55, 1, 0.7] : 0.8,
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: index * 0.12,
          }}
          style={{ height }}
        />
      ))}
    </div>
  );
}

export function Dashboard() {
  const [config] = useState<Config>(loadConfig);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [selectedAP, setSelectedAP] = useState<string | undefined>();
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string; latency: number }>>([]);
  const [scoreHistory, setScoreHistory] = useState<Array<{ time: string; score: number }>>([]);
  const [isScoringPanelOpen, setIsScoringPanelOpen] = useState(false);
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);

  const connectedAP = accessPoints.find(ap => ap.isConnected);

  useEffect(() => {
    const updateData = async () => {
      setIsScanning(true);
      try {
        const backend = await getLatestData();
        const aps = mapBackendAps(backend.aps);
        setAccessPoints(aps);

        const connectedAP = aps.find(ap => ap.isConnected);
        if (connectedAP && config.notifications.alertOnCongestion && connectedAP.score < config.thresholds.fairScore) {
          maybeNotifyCongestion(connectedAP);
        }
        const now = new Date();
        setLastSyncTime(now);

        setLatencyHistory(prev => {
          const newEntry = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            latency: connectedAP?.latency || 0,
          };
          return [...prev.slice(-19), newEntry];
        });

        setScoreHistory(prev => {
          const newEntry = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            score: connectedAP?.score || 0,
          };
          return [...prev.slice(-19), newEntry];
        });
      } catch (error) {
        console.warn('Backend unavailable, falling back to mock data:', error);
        const aps = generateMockAPs(config);
        setAccessPoints(aps);

        const connectedAP = aps.find(ap => ap.isConnected);
        if (connectedAP && config.notifications.alertOnCongestion && connectedAP.score < config.thresholds.fairScore) {
          maybeNotifyCongestion(connectedAP);
        }
        const now = new Date();
        setLastSyncTime(now);

        setLatencyHistory(prev => {
          const newEntry = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            latency: connectedAP?.latency || 0,
          };
          return [...prev.slice(-19), newEntry];
        });

        setScoreHistory(prev => {
          const newEntry = {
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            score: connectedAP?.score || 0,
          };
          return [...prev.slice(-19), newEntry];
        });
      } finally {
        setTimeout(() => setIsScanning(false), 900);
      }
    };

    updateData();
    const interval = setInterval(updateData, config.scanning.intervalSeconds * 1000);

    let removeTrafficListener: (() => void) | undefined;

    if (isNative() && config.features.bandwidthHeavyDetect) {
      WifiMonitor.startTrafficWatch({ thresholdKB: config.scanning.trafficTriggerKB });
      const listenerPromise = WifiMonitor.addListener('trafficSpike', () => {
        void updateData();
      });
      removeTrafficListener = () => {
        void listenerPromise.then((handle) => handle.remove());
        void WifiMonitor.stopTrafficWatch();
      };
    }

    return () => {
      clearInterval(interval);
      removeTrafficListener?.();
    };
  }, [config]);

  useEffect(() => {
    const targetScore = connectedAP?.score || 0;
    let frameId = 0;
    let startTime: number | undefined;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / 700, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(targetScore * eased));

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [connectedAP?.score]);

  if (accessPoints.length === 0) {
    return <EmptyState onRetry={() => setAccessPoints(generateMockAPs(config))} />;
  }

  const bestAP = [...accessPoints].sort((a, b) => b.score - a.score)[0];
  const shouldRecommend = bestAP && connectedAP && (bestAP.score - connectedAP.score) >= config.thresholds.recommendationThreshold;
  const scoreTone = connectedAP && connectedAP.score >= 80 ? 'emerald' : connectedAP && connectedAP.score >= 55 ? 'amber' : 'rose';
  const ringColor = scoreTone === 'emerald' ? '#22c55e' : scoreTone === 'amber' ? '#f59e0b' : '#ef4444';
  const heroBg = scoreTone === 'emerald'
    ? 'from-emerald-500/10 via-emerald-600/5 to-transparent'
    : scoreTone === 'amber'
      ? 'from-amber-500/10 via-orange-500/5 to-transparent'
      : 'from-rose-500/10 via-red-500/5 to-transparent';
  const scoreMessage = connectedAP?.score && connectedAP.score >= 80
    ? "You're on a great connection right now"
    : connectedAP?.score && connectedAP.score >= 55
      ? 'Connection is stable, with room to improve'
      : 'The link needs attention — try a stronger AP';
  const lastUpdatedSeconds = lastSyncTime ? Math.max(0, Math.floor((Date.now() - lastSyncTime.getTime()) / 1000)) : 0;
  const ringRadius = 90;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference - (animatedScore / 100) * ringCircumference;

  const apComparison = accessPoints.slice(0, 4).map(ap => ({
    name: ap.ip || ap.ssid,
    score: ap.score,
    signal: ap.signalQuality,
  }));

  return (
    <div className="space-y-6">
      <motion.div
        className={`relative overflow-hidden rounded-[28px] border border-border bg-gradient-to-br ${heroBg} p-5 shadow-xl`}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="absolute inset-0 opacity-80">
          <div className="absolute -top-10 right-8 h-44 w-44 rounded-full blur-3xl bg-emerald-400/10" />
          <div className="absolute bottom-0 left-0 h-36 w-36 rounded-full blur-3xl bg-blue-400/10" />
        </div>

        <div className="relative grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-6 items-center">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <SignalBars scanning={isScanning} />
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-foreground opacity-60">Current status</p>
                <p className="text-sm font-semibold text-foreground">{scoreMessage}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-foreground opacity-70">
              <Clock3 size={14} />
              <span>Last updated {lastUpdatedSeconds}s ago</span>
            </div>

            <div className="rounded-2xl bg-background/75 border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground opacity-60">Connected access point</p>
                  <p className="font-semibold text-foreground truncate">{connectedAP?.ssid || 'Scanning...'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] uppercase tracking-wide text-foreground opacity-50">SSID</p>
                  <p className="font-mono text-sm font-bold text-blue-600 truncate max-w-[140px]">{connectedAP?.ip || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4">
            <div className="relative flex items-center justify-center">
              <motion.div
                className="absolute h-40 w-40 rounded-full border border-blue-400/20"
                animate={{ scale: isScanning ? [0.9, 1.12, 0.92] : 0.9, opacity: isScanning ? [0.35, 0.7, 0.35] : 0.35 }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <svg width="240" height="240" className="-rotate-90">
                <circle cx="120" cy="120" r={ringRadius} stroke="rgba(148,163,184,0.18)" strokeWidth="18" fill="none" />
                <motion.circle
                  cx="120"
                  cy="120"
                  r={ringRadius}
                  stroke={ringColor}
                  strokeWidth="18"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={ringCircumference}
                  animate={{ strokeDashoffset: ringOffset }}
                  transition={{ duration: 0.7 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <div className="text-[11px] uppercase tracking-[0.26em] text-foreground opacity-60">Score</div>
                <div className="text-5xl font-black text-foreground">{animatedScore}</div>
                <div className="text-sm text-foreground opacity-60">/ 100</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2 bg-background border border-border rounded-[24px] p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-foreground">
              Access Point Radar
            </h3>
            <div className="text-sm text-foreground opacity-50">
              {accessPoints.length} APs detected
            </div>
          </div>

          <div className="flex justify-center">
            <RadialAPMap
              accessPoints={accessPoints}
              selectedAP={selectedAP}
              onSelectAP={(ap) => setSelectedAP(ap.id)}
              size={500}
            />
          </div>
        </motion.div>

        <div className="space-y-6">
          <motion.div
            className="bg-background border border-border rounded-[24px] p-6 shadow-sm"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            {connectedAP && (
              <>
                <ScoreBreakdown
                  totalScore={connectedAP.score}
                  subScores={[
                    {
                      label: 'Signal',
                      value: connectedAP.subScores.signal,
                      weight: config.weights.signal,
                      color: '#10b981',
                    },
                    {
                      label: 'Latency',
                      value: connectedAP.subScores.latency,
                      weight: config.weights.latency,
                      color: '#3b82f6',
                    },
                    {
                      label: 'Loss',
                      value: connectedAP.subScores.loss,
                      weight: config.weights.loss,
                      color: '#f59e0b',
                    },
                    {
                      label: 'Stability',
                      value: connectedAP.subScores.stability,
                      weight: config.weights.stability,
                      color: '#8b5cf6',
                    },
                  ]}
                />
                <button
                  onClick={() => setIsScoringPanelOpen(true)}
                  className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Code size={18} />
                  View Algorithm Details
                </button>
              </>
            )}
          </motion.div>

          {shouldRecommend && bestAP && connectedAP && (
            <motion.button
              className="w-full text-left bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-[24px] p-6 cursor-pointer hover:border-orange-500/40 transition-colors shadow-sm"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsRecommendationModalOpen(true)}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                <div className="space-y-3 flex-1">
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Optimize Connection
                    </h4>
                    <p className="text-sm text-foreground opacity-70">
                      Target IP: <span className="font-mono font-bold text-orange-600">{bestAP.ip}</span> (+{(bestAP.score - connectedAP.score).toFixed(0)} pts)
                    </p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-foreground opacity-70">
                        Better signal: {bestAP.signal.toFixed(0)}dBm vs {connectedAP.signal.toFixed(0)}dBm
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-foreground opacity-70">
                        Lower latency: {bestAP.latency.toFixed(1)}ms vs {connectedAP.latency.toFixed(1)}ms
                      </span>
                    </div>
                  </div>

                  <div className="text-sm font-medium text-orange-600">
                    Open recommendation card →
                  </div>
                </div>
              </div>
            </motion.button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {accessPoints.map((ap, index) => (
          <motion.div
            key={ap.id}
            className="rounded-[24px] border border-border bg-background p-4 shadow-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.07 }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Wifi size={16} className="text-blue-500" />
                  <span className="font-semibold text-foreground">{ap.ssid}</span>
                </div>
                <p className="text-xs text-foreground opacity-60 mt-1">{ap.ip || ap.bssid}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${ap.score >= 80 ? 'bg-emerald-500/10 text-emerald-600' : ap.score >= 55 ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'}`}>
                {ap.score}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-xl bg-muted p-2">
                <div className="flex items-center gap-1 text-foreground opacity-60 text-[11px]">
                  <Signal size={12} />
                  Signal
                </div>
                <div className="font-semibold text-foreground mt-1">{ap.signalQuality}%</div>
              </div>
              <div className="rounded-xl bg-muted p-2">
                <div className="flex items-center gap-1 text-foreground opacity-60 text-[11px]">
                  <Clock3 size={12} />
                  Latency
                </div>
                <div className="font-semibold text-foreground mt-1">{ap.latency.toFixed(0)}ms</div>
              </div>
              <div className="rounded-xl bg-muted p-2">
                <div className="flex items-center gap-1 text-foreground opacity-60 text-[11px]">
                  <Activity size={12} />
                  Loss
                </div>
                <div className="font-semibold text-foreground mt-1">{ap.packetLoss.toFixed(1)}%</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="bg-background border border-border rounded-[24px] p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">
            Live Score Trend
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={scoreHistory}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="time" stroke="var(--foreground)" opacity={0.5} tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--foreground)" opacity={0.5} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: '8px' }} />
              <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#scoreGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="bg-background border border-border rounded-[24px] p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-foreground mb-4">
            AP Score Comparison
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={apComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
              <XAxis dataKey="name" stroke="var(--foreground)" opacity={0.5} tick={{ fontSize: 12 }} />
              <YAxis stroke="var(--foreground)" opacity={0.5} tick={{ fontSize: 12 }} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: '8px' }} />
              <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <div className="bg-blue-600/5 border border-blue-600/20 rounded-[24px] p-6">
        <h3 className="text-lg font-semibold text-blue-700 mb-2 flex items-center gap-2">
          <Activity size={20} />
          Congestion Mitigation Strategy
        </h3>
        <p className="text-sm text-blue-600/80 mb-4">
          Based on current network density and interference levels, the system recommends:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-white/50 rounded-lg border border-blue-100 shadow-sm">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">1. Frequency (35%)</p>
            <p className="text-sm text-blue-600">Prioritize 5GHz bands to avoid 2.4GHz spectrum overlap and noise.</p>
          </div>
          <div className="p-4 bg-white/50 rounded-lg border border-blue-100 shadow-sm">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">2. Channel (30%)</p>
            <p className="text-sm text-blue-600">Switch to non-overlapping channels (1, 6, 11) to reduce co-channel interference.</p>
          </div>
          <div className="p-4 bg-white/50 rounded-lg border border-blue-100 shadow-sm">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-1">3. Placement (35%)</p>
            <p className="text-sm text-blue-600">Position APs away from thick walls and electronic interference sources.</p>
          </div>
        </div>
      </div>

      <ScoringPanel
        isOpen={isScoringPanelOpen}
        onClose={() => setIsScoringPanelOpen(false)}
        accessPoint={connectedAP || null}
        config={config}
      />

      <RecommendationModal
        isOpen={isRecommendationModalOpen}
        onClose={() => setIsRecommendationModalOpen(false)}
        currentAP={connectedAP || null}
        recommendedAP={bestAP || null}
        config={config}
      />
    </div>
  );
}
