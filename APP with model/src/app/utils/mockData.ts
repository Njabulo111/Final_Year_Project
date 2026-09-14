import { AccessPoint, NetworkMetrics, HistoricalData, Config } from '../types/wifi';

const AP_NAMES = [
  'WiFi-Main-Floor-1',
  'WiFi-Main-Floor-2',
  'WiFi-Conference-A',
  'WiFi-Conference-B',
  'WiFi-Dev-Lab',
  'WiFi-Lobby',
  'WiFi-Kitchen',
  'WiFi-Outdoor',
];

function calculateScore(ap: Partial<AccessPoint>, config: Config): number {
  const normalizedSignal = Math.max(0, Math.min(100,
    ((ap.signal || -70) - config.normalization.signalMin) /
    (config.normalization.signalMax - config.normalization.signalMin) * 100
  ));

  const normalizedLatency = Math.max(0, Math.min(100,
    100 - ((ap.latency || 20) / config.normalization.latencyMax * 100)
  ));

  const normalizedLoss = Math.max(0, Math.min(100,
    100 - ((ap.packetLoss || 0) / config.normalization.lossMax * 100)
  ));

  const normalizedStability = ap.stability || 95;

  const score =
    normalizedSignal * config.weights.signal +
    normalizedLatency * config.weights.latency +
    normalizedLoss * config.weights.loss +
    normalizedStability * config.weights.stability;

  return Math.round(score);
}

function getStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

export function generateMockAPs(config: Config): AccessPoint[] {
  return AP_NAMES.map((name, index) => {
    const signal = -45 - Math.random() * 40;
    const latency = 5 + Math.random() * 45;
    const packetLoss = Math.random() * 3;
    const stability = 85 + Math.random() * 15;

    const subScores = {
      signal: Math.round(((signal + 85) / 40) * 100),
      latency: Math.round(100 - (latency / 50) * 100),
      loss: Math.round(100 - (packetLoss / 5) * 100),
      stability: Math.round(stability),
    };

    const ap: Partial<AccessPoint> = {
      signal,
      latency,
      packetLoss,
      stability,
    };

    const score = calculateScore(ap, config);

    return {
      id: `ap-${index}`,
      ssid: name,
      bssid: `00:${Math.floor(Math.random() * 99).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 99).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 99).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 99).toString(16).padStart(2, '0')}:${Math.floor(Math.random() * 99).toString(16).padStart(2, '0')}`,
      channel: [1, 6, 11, 36, 40, 44, 48][Math.floor(Math.random() * 7)],
      frequency: Math.random() > 0.5 ? 5180 + Math.floor(Math.random() * 500) : 2412 + (index * 5),
      signal,
      signalQuality: Math.round(((signal + 85) / 40) * 100),
      latency,
      packetLoss,
      stability,
      score,
      status: getStatus(score),
      isConnected: index === 0,
      position: {
        angle: (index / AP_NAMES.length) * 360,
        distance: 0.5 + Math.random() * 0.4,
      },
      lastSeen: new Date(Date.now() - Math.random() * 60000),
      subScores,
    };
  });
}

export function generateMockMetrics(aps: AccessPoint[]): NetworkMetrics {
  const connectedAP = aps.find(ap => ap.isConnected) || aps[0];
  return {
    currentAP: connectedAP.ssid,
    score: connectedAP.score,
    latency: connectedAP.latency,
    packetLoss: connectedAP.packetLoss,
    signalStrength: connectedAP.signal,
    trend: Math.random() > 0.5 ? 'up' : Math.random() > 0.5 ? 'down' : 'stable',
  };
}

export function generateHistoricalData(hours: number = 24): HistoricalData[] {
  const data: HistoricalData[] = [];
  const now = Date.now();
  const interval = (hours * 60 * 60 * 1000) / 100;

  for (let i = 0; i < 100; i++) {
    data.push({
      timestamp: new Date(now - (100 - i) * interval),
      score: 60 + Math.random() * 35 + Math.sin(i / 10) * 10,
      latency: 10 + Math.random() * 20 + Math.cos(i / 8) * 5,
      signal: -50 - Math.random() * 20,
      apId: `ap-${Math.floor(Math.random() * 3)}`,
    });
  }

  return data;
}

export const defaultConfig: Config = {
  weights: {
    signal: 0.3,
    latency: 0.3,
    loss: 0.25,
    stability: 0.15,
  },
  thresholds: {
    excellentScore: 85,
    goodScore: 70,
    fairScore: 50,
    recommendationThreshold: 20,
  },
  scanning: {
    intervalSeconds: 10,
    pingCount: 10,
    timeoutMs: 1000,
  },
  normalization: {
    signalMin: -85,
    signalMax: -45,
    latencyMin: 0,
    latencyMax: 50,
    lossMax: 5,
    stabilityWindow: 60,
  },
};
