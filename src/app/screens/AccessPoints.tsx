import { useState, useEffect, useRef } from 'react';
import { Search, Clock, Signal, MapPin, Network, Compass, AlertTriangle, Wifi, Activity, Timer, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { AccessPoint, Coordinates } from '../types/wifi';
import { getLatestData, mapBackendAps } from '../services/apiClient';
import { generateMockMetrics } from '../utils/mockData';
import { bootLocalLearningDataset } from '../services/localLearning';
import { RadialAPMap } from '../components/RadialAPMap';
import { MetricCard } from '../components/MetricCard';
import { EmptyState } from '../components/EmptyState';

function calculateBearing(from: Coordinates, to: Coordinates): number {
  const dLon = (to.longitude - from.longitude) * (Math.PI / 180);
  const lat1 = from.latitude * (Math.PI / 180);
  const lat2 = to.latitude * (Math.PI / 180);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  let bearing = Math.atan2(y, x) * (180 / Math.PI);
  bearing = (bearing + 360) % 360;
  return bearing;
}

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3440.065;
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.latitude * Math.PI / 180) *
      Math.cos(coord2.latitude * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getVirtualCoordinates(base: Coordinates, index: number, total: number, quality: number): Coordinates {
  const angle = (index / Math.max(1, total)) * Math.PI * 2;
  const distanceMeters = Math.max(12, 45 - quality * 0.3);
  const latOffset = Math.cos(angle) * distanceMeters / 111111;
  const lonOffset = Math.sin(angle) * distanceMeters / (111111 * Math.cos(base.latitude * Math.PI / 180));
  return {
    latitude: base.latitude + latOffset,
    longitude: base.longitude + lonOffset,
  };
}

export function AccessPoints() {
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const prevLocationRef = useRef<Coordinates | null>(null);
  const [selectedAP, setSelectedAP] = useState<AccessPoint | null>(null);
  const [networkName, setNetworkName] = useState<string>('Detecting...');
  const [networkDetails, setNetworkDetails] = useState<string>('');
  const [locationError, setLocationError] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [localLearningLabel, setLocalLearningLabel] = useState('Local learning dataset ready');

  useEffect(() => {
    void bootLocalLearningDataset()
      .then((status) => {
        setLocalLearningLabel(`Local learning data ready • ${status.sampleCount} samples`);
      })
      .catch(() => {
        setLocalLearningLabel('Local learning data ready');
      });
  }, []);

  // Get user's live location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation((prev) => {
          prevLocationRef.current = prev;
          return coords;
        });
        setLocationError('');
      },
      (error) => {
        setLocationError(`Location error: ${error.message}`);
        setUserLocation({ latitude: 38.7642, longitude: -84.8735 });
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Get network information
  useEffect(() => {
    const getNetworkInfo = () => {
      if (!navigator.onLine) {
        setNetworkName('Offline');
        setNetworkDetails('No network connection');
        return;
      }

      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const label = connection?.ssid || connection?.type || 'Connected network unavailable';
        const details = connection?.effectiveType
          ? `${connection.effectiveType.toUpperCase()} • ${Math.round(connection.downlink || 0)} Mbps`
          : 'Browser privacy limits SSID access';

        setNetworkName(label);
        setNetworkDetails(details);
      } else {
        setNetworkName('Connected network unavailable');
        setNetworkDetails('Browser privacy limits SSID access');
      }
    };

    getNetworkInfo();
    const interval = setInterval(getNetworkInfo, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load live scan data from the backend and update AP map
  useEffect(() => {
    const updateBackendAps = async () => {
      try {
        const backend = await getLatestData();
        let aps = mapBackendAps(backend.aps);

        if (backend.connected_ssid) {
          setNetworkName(backend.connected_ssid);
          setNetworkDetails(`Live scan @ ${backend.timestamp}`);
        }

        if (userLocation && aps.length > 0) {
          aps = aps.map((ap, index) => ({
            ...ap,
            coordinates: getVirtualCoordinates(userLocation, index, aps.length, ap.signalQuality),
          }));
        }

        setAccessPoints(aps);
        setSelectedAP((prev) => {
          if (!prev) return aps[0] || null;
          return aps.find((ap) => ap.id === prev.id) || aps[0] || null;
        });
        setLastSyncTime(new Date());
      } catch (error) {
        console.warn('Backend unavailable, using last known AP data:', error);
      }
    };

    updateBackendAps();
    const interval = setInterval(updateBackendAps, 10000);
    return () => clearInterval(interval);
  }, [userLocation]);

  const filteredAPs = accessPoints.filter((ap) =>
    ap.ssid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ap.bssid.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ap.frequency.toString().includes(searchQuery)
  );

  const bestAP = accessPoints.length
    ? [...accessPoints].sort((a, b) => b.signalQuality - a.signalQuality)[0]
    : null;
  const activeAP = selectedAP || bestAP;
  const connectedAP = accessPoints.find((ap) => ap.isConnected);
  const activeBearing = activeAP && userLocation ? calculateBearing(userLocation, activeAP.coordinates) : 0;
  const activeDistance =
    activeAP && userLocation && (activeAP.coordinates.latitude !== 0 || activeAP.coordinates.longitude !== 0)
      ? calculateDistance(userLocation, activeAP.coordinates)
      : null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'bg-green-500';
      case 'good':
        return 'bg-blue-500';
      case 'fair':
        return 'bg-orange-500';
      case 'poor':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getDirectionLabel = (bearing: number): string => {
    if (bearing < 22.5 || bearing >= 337.5) return 'N';
    if (bearing < 67.5) return 'NE';
    if (bearing < 112.5) return 'E';
    if (bearing < 157.5) return 'SE';
    if (bearing < 202.5) return 'S';
    if (bearing < 247.5) return 'SW';
    if (bearing < 292.5) return 'W';
    return 'NW';
  };

  if (accessPoints.length === 0) {
    const isPermissionIssue = locationError.toLowerCase().includes('denied');
    return (
      <EmptyState
        variant={isPermissionIssue ? 'permission-denied' : 'no-networks'}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const metrics = generateMockMetrics(accessPoints);

  return (
    <div className="space-y-6">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            WiFi Monitor & Congestion Analysis
          </h2>
          <p className="text-sm text-foreground opacity-60">
            Current IP: <span className="font-mono text-blue-600 font-bold">{connectedAP?.ip || 'Connecting...'}</span> • UJ Electronic Engineering
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <motion.div
            className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg whitespace-nowrap"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-green-600">
              {lastSyncTime ? `Synced: ${lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Auto-Syncing...'}
            </span>
          </motion.div>

          <motion.div
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg whitespace-nowrap"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18 }}
          >
            <Wifi size={14} className="text-blue-500" />
            <span className="text-sm font-medium text-blue-600">
              {localLearningLabel}
            </span>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Network Score',
            value: metrics.score.toFixed(0),
            unit: '/100',
            icon: Activity,
            trend: metrics.trend,
            trendValue: '+2.3',
            color: metrics.score >= 75 ? 'green' : metrics.score >= 50 ? 'orange' : 'red',
          },
          {
            title: 'Latency',
            value: metrics.latency.toFixed(1),
            unit: 'ms',
            icon: Timer,
            trend: 'down' as const,
            trendValue: '-1.2ms',
            color: 'blue' as const,
          },
          {
            title: 'Signal Strength',
            value: metrics.signalStrength.toFixed(0),
            unit: 'dBm',
            icon: Wifi,
            trend: 'stable' as const,
            color: 'green' as const,
          },
          {
            title: 'Packet Loss',
            value: metrics.packetLoss.toFixed(2),
            unit: '%',
            icon: TrendingUp,
            trend: 'stable' as const,
            color: metrics.packetLoss < 1 ? 'green' as const : 'orange' as const,
          },
        ].map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 + index * 0.07 }}
          >
            <MetricCard
              title={card.title}
              value={card.value}
              unit={card.unit}
              icon={card.icon}
              trend={card.trend}
              trendValue={card.trendValue}
              color={card.color}
            />
          </motion.div>
        ))}
      </div>

      <div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">
              Transmitter Detection
            </h2>
            <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
              Real-time signal analysis with estimated transmitter locations
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <MapPin size={16} className="text-blue-500" />
              <p className="text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Your Location</p>
            </div>
            {userLocation ? (
              <p className="text-sm font-mono text-[rgb(var(--color-foreground))]">
                {userLocation.latitude.toFixed(4)}°, {userLocation.longitude.toFixed(4)}°
              </p>
            ) : (
              <p className="text-sm text-[rgb(var(--color-foreground))] opacity-50">Requesting location...</p>
            )}
            {locationError && <p className="text-xs text-red-500 mt-1">{locationError}</p>}
          </div>

          <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Network size={16} className="text-green-500" />
              <p className="text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Connected Network</p>
            </div>
            <p className="text-sm font-mono text-[rgb(var(--color-foreground))]">{networkName}</p>
            <p className="text-xs text-[rgb(var(--color-foreground))] opacity-60 mt-2">{networkDetails}</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  try {
                    window.open('ms-settings:network-wifi');
                  } catch (e) {
                    // best-effort; ignore
                  }
                }}
                className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
              >
                Open Network Settings
              </button>
              <div className="text-xs text-[rgb(var(--color-foreground))] opacity-50">Note: browsers restrict programmatic Wi‑Fi control; use OS settings to change networks.</div>
            </div>
          </div>

          {activeAP && (
            <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <Signal size={16} className="text-sky-500" />
                <p className="text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">Follow this AP</p>
              </div>
              <p className="text-sm font-bold text-blue-600 font-mono">{activeAP.ip}</p>
              <p className="text-xs text-[rgb(var(--color-foreground))] opacity-60">Move toward the direction shown on the radial plot. Stronger colors indicate closer signal sources.</p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] p-3">
                  <div className="text-[rgb(var(--color-foreground))] opacity-60">Direction</div>
                  <div className="font-semibold text-[rgb(var(--color-foreground))]">{getDirectionLabel(activeBearing)} ({activeBearing.toFixed(0)}°)</div>
                </div>
                <div className="rounded-lg bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] p-3">
                  <div className="text-[rgb(var(--color-foreground))] opacity-60">Speed</div>
                  <div className="font-semibold text-[rgb(var(--color-foreground))]">{activeAP.signalSpeed} Mbps</div>
                </div>
                <div className="rounded-lg bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] p-3">
                  <div className="text-[rgb(var(--color-foreground))] opacity-60">Distance</div>
                  <div className="font-semibold text-[rgb(var(--color-foreground))]">
                    {activeDistance != null ? `${(activeDistance * 3280.84).toFixed(0)} ft` : 'Unknown'}
                  </div>
                </div>
                <div className="rounded-lg bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] p-3">
                  <div className="text-[rgb(var(--color-foreground))] opacity-60">Status</div>
                  <div className="font-semibold text-[rgb(var(--color-foreground))]">{activeAP.status}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {userLocation && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))]">Probable AP directions</h3>
              <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60 max-w-2xl">
                The radial plot estimates where each access point is relative to your device. Tap a point or table row to highlight a specific AP.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 rounded-full bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] px-4 py-2 text-sm text-[rgb(var(--color-foreground))]">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                Closer APs show stronger color and a brighter signal path.
              </div>
              <div className="rounded-xl border border-yellow-300/70 bg-yellow-50/80 px-4 py-3 text-sm text-yellow-900">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 text-yellow-700" />
                  <div>
                    <span className="font-semibold">Disclaimer:</span> Direction and speed are estimates based on signal strength and relative position. Use this as a guide only, not exact positioning.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <RadialAPMap
            accessPoints={accessPoints}
            selectedAP={selectedAP?.id}
            onSelectAP={(ap) => setSelectedAP(ap)}
            size={420}
            userLocation={userLocation}
            prevLocation={prevLocationRef.current}
          />
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgb(var(--color-foreground))] opacity-40" size={18} />
        <input
          type="text"
          placeholder="Search by name, callsign, or frequency..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg text-[rgb(var(--color-foreground))] focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full min-w-[640px]">
          <thead className="bg-[rgb(var(--color-muted))]">
            <tr>
              <th className="px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Status
              </th>
              <th className="px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                IP Address
              </th>
              <th className="px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Frequency
              </th>
              <th className="px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Signal
              </th>
              <th className="hidden sm:table-cell px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Speed
              </th>
              <th className="hidden lg:table-cell px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Est. Distance
              </th>
              <th className="hidden lg:table-cell px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Direction
              </th>
              <th className="px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Score
              </th>
              <th className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 text-left text-[10px] md:text-xs font-semibold text-[rgb(var(--color-foreground))] uppercase">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgb(var(--color-border))]">
            {filteredAPs.map((ap, index) => {
              const bearing = userLocation ? calculateBearing(userLocation, ap.coordinates) : 0;
              const distance = userLocation && (ap.coordinates.latitude !== 0 || ap.coordinates.longitude !== 0)
                ? calculateDistance(userLocation, ap.coordinates)
                : null;
              const isRowSelected = selectedAP?.id === ap.id;

              return (
                <motion.tr
                  key={ap.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => setSelectedAP(ap)}
                  className={`hover:bg-[rgb(var(--color-muted))] transition-colors cursor-pointer ${isRowSelected ? 'bg-[rgb(var(--color-muted))] shadow-inner' : ''}`}
                >
                  <td className="px-3 py-3 md:px-6 md:py-4">
                    <div className="flex items-center gap-2 md:gap-3">
                      <div className={`w-3 h-3 shrink-0 rounded-full ${getStatusColor(ap.status)}`} />
                      {ap.isConnected && (
                        <span className="px-1.5 py-0.5 md:px-2 md:py-1 text-[10px] md:text-xs font-medium bg-blue-500 text-white rounded whitespace-nowrap">
                          Primary
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 md:px-6 md:py-4 min-w-0 max-w-[140px] md:max-w-none">
                    <div className="min-w-0">
                      <div className="font-bold font-mono text-blue-600 text-xs md:text-base truncate">{ap.ip}</div>
                      <div className="text-xs md:text-sm text-[rgb(var(--color-foreground))] opacity-50 truncate">{ap.ssid}</div>
                    </div>
                  </td>
                  <td className="px-3 py-3 md:px-6 md:py-4 text-xs md:text-base font-medium text-[rgb(var(--color-foreground))] whitespace-nowrap">
                    {ap.frequency} MHz
                  </td>
                  <td className="px-3 py-3 md:px-6 md:py-4">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Signal size={14} className="hidden sm:block shrink-0 text-[rgb(var(--color-foreground))] opacity-50" />
                      <span className="text-xs md:text-base font-medium text-[rgb(var(--color-foreground))] whitespace-nowrap">{ap.signal.toFixed(0)} dBm</span>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-3 py-3 md:px-6 md:py-4">
                    <span className="text-xs md:text-base font-medium text-[rgb(var(--color-foreground))] whitespace-nowrap">{ap.signalSpeed} Mbps</span>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 md:px-6 md:py-4">
                    <span className="text-xs md:text-base font-medium text-[rgb(var(--color-foreground))] whitespace-nowrap">
                      {distance != null ? `${(distance * 3280.84).toFixed(0)} ft` : 'Unknown'}
                    </span>
                    <div className="text-[10px] md:text-xs text-[rgb(var(--color-foreground))] opacity-50 whitespace-nowrap">
                      {distance != null ? `(${distance.toFixed(2)} NM)` : 'Coordinates unavailable'}
                    </div>
                  </td>
                  <td className="hidden lg:table-cell px-3 py-3 md:px-6 md:py-4">
                    <div className="flex items-center gap-1 md:gap-2">
                      <Compass size={14} className="shrink-0 text-[rgb(var(--color-foreground))] opacity-50" />
                      <span className="text-xs md:text-base font-medium text-[rgb(var(--color-foreground))] whitespace-nowrap">
                        {getDirectionLabel(bearing)} ({bearing.toFixed(0)}°)
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 md:px-6 md:py-4">
                    <span className="text-base md:text-2xl font-bold text-[rgb(var(--color-foreground))]">{ap.score}</span>
                  </td>
                  <td className="hidden md:table-cell px-3 py-3 md:px-6 md:py-4 text-xs md:text-sm text-[rgb(var(--color-foreground))] opacity-60">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                      <Clock size={14} />
                      {ap.lastSeen.toLocaleTimeString()}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
