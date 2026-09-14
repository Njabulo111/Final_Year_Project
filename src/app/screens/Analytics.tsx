import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
import { getHistory, mapHistoryRows } from '../services/apiClient';
import { generateHistoricalData, generateMockSwitchEvents } from '../utils/mockData';

type MappedHistoryRow = ReturnType<typeof mapHistoryRows>[number];

export function Analytics() {
  const [historyData, setHistoryData] = useState<MappedHistoryRow[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');
  const [ssidFilter, setSsidFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    const limit = timeRange === '24h' ? 48 : timeRange === '7d' ? 120 : 200;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const rows = await getHistory(limit);
        const mapped = mapHistoryRows(rows);
        mapped.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        setHistoryData(mapped);
      } catch (error) {
        console.warn('History API unavailable, using fallback data:', error);
        const fallback = generateHistoricalData(hours).map((d) => ({
          id: 0,
          timestamp: d.timestamp,
          ssid: 'Offline Scan',
          bssid: `00:00:00:00:00:${Math.floor(Math.random() * 100).toString().padStart(2, '0')}`,
          rssi: d.signal,
          channel: 6,
          band: '2.4GHz',
          is_connected: 0,
          latency_ms: d.latency,
          loss_pct: 0,
          score: d.score,
          status: d.score >= 75 ? 'good' : d.score >= 50 ? 'fair' : 'poor',
          recommendation: null,
        }));
        setHistoryData(fallback);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [timeRange]);

  const ssidOptions = useMemo(
    () => Array.from(new Set(historyData.map((d) => d.ssid))).filter(Boolean),
    [historyData],
  );

  const filteredData = useMemo(
    () => (ssidFilter === 'all' ? historyData : historyData.filter((d) => d.ssid === ssidFilter)),
    [historyData, ssidFilter],
  );

  const switchEvents = useMemo(() => generateMockSwitchEvents(6), []);

  const formatTime = (date: Date) => {
    if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = filteredData.map((d) => ({
    time: formatTime(d.timestamp),
    score: Math.round(d.score),
    latency: Math.round(d.latency_ms ?? 0),
    ip: d.bssid,
  }));

  const avgScore = chartData.length > 0 ? chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">History</h2>
          <p className="text-sm text-muted-foreground">Network performance trends and insights</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={ssidFilter}
            onChange={(e) => setSsidFilter(e.target.value)}
            className="rounded-lg border border-border-hairline bg-surface-card px-3 py-2 text-sm text-foreground"
          >
            <option value="all">All networks</option>
            {ssidOptions.map((ssid) => (
              <option key={ssid} value={ssid}>
                {ssid}
              </option>
            ))}
          </select>

          <div className="flex gap-2">
            {(['24h', '7d', '30d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  timeRange === range
                    ? 'bg-accent-signal text-background'
                    : 'border border-border-hairline bg-surface-card text-foreground hover:border-accent-signal'
                }`}
              >
                {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-3 flex items-center gap-3">
          <div className="rounded-lg bg-accent-signal/15 p-2">
            <TrendingUp className="text-accent-signal" size={20} />
          </div>
          <h3 className="font-semibold text-foreground">Average Score</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-accent-signal">{avgScore.toFixed(0)}</span>
          <span className="text-sm text-muted-foreground">/100</span>
        </div>
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <h3 className="mb-6 text-lg font-semibold text-foreground">Score Trend</h3>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading analytics...</div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent-signal)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--accent-signal)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis dataKey="time" stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} interval="preserveStartEnd" />
              <YAxis stroke="var(--muted-foreground)" tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: 'var(--surface-card)', border: '1px solid var(--border-hairline)', borderRadius: '8px' }} />
              <ReferenceLine y={75} stroke="var(--status-good)" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Good', position: 'insideTopRight', fill: 'var(--status-good)', fontSize: 11 }} />
              <ReferenceLine y={50} stroke="var(--status-moderate)" strokeDasharray="4 4" strokeOpacity={0.6} label={{ value: 'Moderate', position: 'insideTopRight', fill: 'var(--status-moderate)', fontSize: 11 }} />
              <Area type="monotone" dataKey="score" stroke="var(--accent-signal)" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Recent Switches</p>
        <div className="divide-y divide-border-hairline">
          {switchEvents.map((event) => (
            <div key={event.id} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-mono text-sm text-foreground">
                  {event.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} {event.fromLabel} → {event.toLabel}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Score: {event.fromScore} → {event.toScore}
                </p>
              </div>
              {event.improved ? (
                <CheckCircle2 size={18} className="shrink-0 text-status-good" />
              ) : (
                <XCircle size={18} className="shrink-0 text-status-congested" />
              )}
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
