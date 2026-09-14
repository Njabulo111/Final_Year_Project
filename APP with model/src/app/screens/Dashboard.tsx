import { useState, useEffect } from 'react';
import { MetricCard } from '../components/MetricCard';
import { RadialAPMap } from '../components/RadialAPMap';
import { ScoreBreakdown } from '../components/ScoreBreakdown';
import { ScoringPanel } from '../components/ScoringPanel';
import { RecommendationModal } from '../components/RecommendationModal';
import { EmptyState } from '../components/EmptyState';
import { Wifi, Activity, Timer, TrendingUp, AlertTriangle, CheckCircle2, Code } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { motion } from 'motion/react';
import { AccessPoint, Config } from '../types/wifi';
import { generateMockAPs, generateMockMetrics, defaultConfig } from '../utils/mockData';
import api from '../utils/apiClient';

export function Dashboard() {
  const [config] = useState<Config>(defaultConfig);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [selectedAP, setSelectedAP] = useState<string | undefined>();
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string; latency: number }>>([]);
  const [isScoringPanelOpen, setIsScoringPanelOpen] = useState(false);
  const [isRecommendationModalOpen, setIsRecommendationModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [useRealData, setUseRealData] = useState(false);

  useEffect(() => {
    const updateData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let aps: AccessPoint[] = [];

        if (useRealData) {
          try {
            // Try to fetch real data from backend
            const result = await api.scan();
            if (result.success && result.networks) {
              aps = result.networks;
              console.log('Loaded real WiFi data:', aps.length, 'networks');
            } else {
              throw new Error('Invalid response format');
            }
          } catch (apiError) {
            console.warn('Backend unavailable, falling back to mock data:', apiError);
            aps = generateMockAPs(config);
            setUseRealData(false);
          }
        } else {
          aps = generateMockAPs(config);
        }

        setAccessPoints(aps);

        // Update latency history
        setLatencyHistory(prev => {
          const newEntry = {
            time: new Date().toLocaleTimeString(),
            latency: aps.find(ap => ap.isConnected)?.latency || 0,
          };
          return [...prev.slice(-19), newEntry];
        });
      } catch (err) {
        console.error('Data update error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };

    updateData();
    const interval = setInterval(updateData, 10000);

    return () => clearInterval(interval);
  }, [config, useRealData]);

  if (accessPoints.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
            Live Network Monitor
          </h2>
          <button
            onClick={() => setUseRealData(!useRealData)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              useRealData
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {useRealData ? 'Real Data (Connected)' : 'Demo Data'}
          </button>
        </div>
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-sm text-red-600">Error: {error}</p>
          </div>
        )}
        <EmptyState onRetry={() => setAccessPoints(generateMockAPs(config))} />
      </div>
    );
  }

  const metrics = generateMockMetrics(accessPoints);
  const connectedAP = accessPoints.find(ap => ap.isConnected);
  const bestAP = [...accessPoints].sort((a, b) => b.score - a.score)[0];
  const shouldRecommend = bestAP && connectedAP && (bestAP.score - connectedAP.score) >= config.thresholds.recommendationThreshold;

  const apComparison = accessPoints.slice(0, 4).map(ap => ({
    name: ap.ssid.split('-').pop() || ap.ssid,
    score: ap.score,
    signal: ap.signalQuality,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
            Live Network Monitor
          </h2>
          <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
            Real-time monitoring with 10-second updates
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setUseRealData(!useRealData)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
              useRealData
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
            title={useRealData ? 'Using real WiFi data' : 'Using demo data'}
          >
            {useRealData ? '🔴 Real Data' : '⚪ Demo Data'}
          </button>

          <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-blue-600">
              Auto-refresh: 10s
            </span>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm text-red-600">⚠️ {error}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Network Score"
          value={metrics.score.toFixed(0)}
          unit="/100"
          icon={Activity}
          trend={metrics.trend}
          trendValue="+2.3"
          color={metrics.score >= 85 ? 'green' : metrics.score >= 70 ? 'blue' : metrics.score >= 50 ? 'orange' : 'red'}
        />
        <MetricCard
          title="Latency"
          value={metrics.latency.toFixed(1)}
          unit="ms"
          icon={Timer}
          trend="down"
          trendValue="-1.2ms"
          color="blue"
        />
        <MetricCard
          title="Signal Strength"
          value={metrics.signalStrength.toFixed(0)}
          unit="dBm"
          icon={Wifi}
          trend="stable"
          color="green"
        />
        <MetricCard
          title="Packet Loss"
          value={metrics.packetLoss.toFixed(2)}
          unit="%"
          icon={TrendingUp}
          trend="stable"
          color={metrics.packetLoss < 1 ? 'green' : 'orange'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          className="lg:col-span-2 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))]">
              Access Point Radar
            </h3>
            <div className="text-sm text-[rgb(var(--color-foreground))] opacity-50">
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
            className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
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
            <motion.div
              className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-xl p-6 cursor-pointer hover:border-orange-500/40 transition-colors"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={() => setIsRecommendationModalOpen(true)}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-orange-600 flex-shrink-0 mt-1" size={20} />
                <div className="space-y-3 flex-1">
                  <div>
                    <h4 className="font-semibold text-[rgb(var(--color-foreground))] mb-1">
                      Better AP Available
                    </h4>
                    <p className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
                      Switch to <strong>{bestAP.ssid}</strong> for +{(bestAP.score - connectedAP.score).toFixed(0)} points
                    </p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-[rgb(var(--color-foreground))] opacity-70">
                        Better signal: {bestAP.signal.toFixed(0)}dBm vs {connectedAP.signal.toFixed(0)}dBm
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <span className="text-[rgb(var(--color-foreground))] opacity-70">
                        Lower latency: {bestAP.latency.toFixed(1)}ms vs {connectedAP.latency.toFixed(1)}ms
                      </span>
                    </div>
                  </div>

                  <button className="text-sm font-medium text-orange-600 hover:text-orange-700">
                    View Detailed Comparison →
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
            Latency Trend (Last 200s)
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={latencyHistory}>
              <defs>
                <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" opacity={0.3} />
              <XAxis
                dataKey="time"
                stroke="rgb(var(--color-foreground))"
                opacity={0.5}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                opacity={0.5}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(var(--color-background))',
                  border: '1px solid rgb(var(--color-border))',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="#3b82f6"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#latencyGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div
          className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-4">
            AP Score Comparison
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={apComparison}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" opacity={0.3} />
              <XAxis
                dataKey="name"
                stroke="rgb(var(--color-foreground))"
                opacity={0.5}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                stroke="rgb(var(--color-foreground))"
                opacity={0.5}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgb(var(--color-background))',
                  border: '1px solid rgb(var(--color-border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="score" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
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
