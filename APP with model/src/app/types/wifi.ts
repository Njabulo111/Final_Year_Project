export interface AccessPoint {
  id: string;
  ssid: string;
  bssid: string;
  channel: number;
  frequency: number;
  signal: number;
  signalQuality: number;
  latency: number;
  packetLoss: number;
  stability: number;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  isConnected: boolean;
  position: { angle: number; distance: number };
  lastSeen: Date;
  subScores: {
    signal: number;
    latency: number;
    loss: number;
    stability: number;
  };
}

export interface NetworkMetrics {
  currentAP: string;
  score: number;
  latency: number;
  packetLoss: number;
  signalStrength: number;
  trend: 'up' | 'down' | 'stable';
}

export interface HistoricalData {
  timestamp: Date;
  score: number;
  latency: number;
  signal: number;
  apId: string;
}

export interface Config {
  weights: {
    signal: number;
    latency: number;
    loss: number;
    stability: number;
  };
  thresholds: {
    excellentScore: number;
    goodScore: number;
    fairScore: number;
    recommendationThreshold: number;
  };
  scanning: {
    intervalSeconds: number;
    pingCount: number;
    timeoutMs: number;
  };
  normalization: {
    signalMin: number;
    signalMax: number;
    latencyMin: number;
    latencyMax: number;
    lossMax: number;
    stabilityWindow: number;
  };
}

export interface Recommendation {
  currentAP: AccessPoint;
  recommendedAP: AccessPoint;
  reasons: string[];
  scoreDifference: number;
}
