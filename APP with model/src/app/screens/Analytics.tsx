import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { TrendingUp } from 'lucide-react';
import { HistoricalData } from '../types/wifi';
import { generateHistoricalData } from '../utils/mockData';

export function Analytics() {
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  useEffect(() => {
    const hours = timeRange === '24h' ? 24 : timeRange === '7d' ? 168 : 720;
    setHistoricalData(generateHistoricalData(hours));
  }, [timeRange]);

  const formatTime = (date: Date) => {
    if (timeRange === '24h') {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const chartData = historicalData.map(d => ({
    time: formatTime(d.timestamp),
    score: Math.round(d.score),
    latency: Math.round(d.latency),
  }));

  const avgScore = chartData.reduce((sum, d) => sum + d.score, 0) / chartData.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
            Historical Analytics
          </h2>
          <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
            Network performance trends and insights
          </p>
        </div>

        <div className="flex gap-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                timeRange === range
                  ? 'bg-blue-500 text-white'
                  : 'bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] text-[rgb(var(--color-foreground))] hover:border-blue-500'
              }`}
            >
              {range === '24h' ? '24 Hours' : range === '7d' ? '7 Days' : '30 Days'}
            </button>
          ))}
        </div>
      </div>

      <motion.div
        className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <TrendingUp className="text-blue-600" size={20} />
          </div>
          <h3 className="font-semibold text-[rgb(var(--color-foreground))]">Average Score</h3>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-bold text-blue-600">{avgScore.toFixed(0)}</span>
          <span className="text-sm text-[rgb(var(--color-foreground))] opacity-50">/100</span>
        </div>
      </motion.div>

      <motion.div
        className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-6">Score Over Time</h3>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--color-border))" opacity={0.3} />
            <XAxis dataKey="time" stroke="rgb(var(--color-foreground))" opacity={0.5} tick={{ fontSize: 12 }} interval="preserveStartEnd" />
            <YAxis stroke="rgb(var(--color-foreground))" opacity={0.5} tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip contentStyle={{ backgroundColor: 'rgb(var(--color-background))', border: '1px solid rgb(var(--color-border))', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#scoreGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
