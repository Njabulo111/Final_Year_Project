import { useState, useEffect } from 'react';
import { Search, Wifi } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessPoint, Config } from '../types/wifi';
import { generateMockAPs, defaultConfig } from '../utils/mockData';

export function AccessPoints() {
  const [config] = useState<Config>(defaultConfig);
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const updateData = () => {
      setAccessPoints(generateMockAPs(config));
    };
    updateData();
    const interval = setInterval(updateData, 10000);
    return () => clearInterval(interval);
  }, [config]);

  const filteredAPs = accessPoints.filter(ap => 
    ap.ssid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ap.bssid.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-orange-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
          Access Points
        </h2>
        <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
          Comprehensive list of all detected access points
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-foreground))] opacity-40" size={18} />
        <input
          type="text"
          placeholder="Search by SSID or BSSID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg text-[rgb(var(--color-foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-[rgb(var(--color-muted))]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Status</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">SSID / BSSID</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Score</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Signal</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Latency</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Channel</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--color-border))]">
            {filteredAPs.map((ap, index) => (
              <motion.tr
                key={ap.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-[rgb(var(--color-muted))] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(ap.status)}`} />
                    {ap.isConnected && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-500 text-white rounded">
                        Connected
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium text-[rgb(var(--color-foreground))]">{ap.ssid}</div>
                    <div className="text-sm text-[rgb(var(--color-foreground))] opacity-50">{ap.bssid}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-2xl font-bold text-[rgb(var(--color-foreground))]">{ap.score}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Wifi size={16} className="text-[rgb(var(--color-foreground))] opacity-50" />
                    <span className="font-medium text-[rgb(var(--color-foreground))]">{ap.signal.toFixed(0)} dBm</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="font-medium text-[rgb(var(--color-foreground))]">{ap.latency.toFixed(1)} ms</span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-[rgb(var(--color-muted))] rounded text-sm text-[rgb(var(--color-foreground))]">{ap.channel}</span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
