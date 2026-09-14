export interface Coordinates {
  latitude: number;
  longitude: number;
}

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
  coordinates: Coordinates;
  rangeNM: number;
  signalSpeed: number;
  lastSeen: Date;
  ip?: string;
  subScores: {
    signal: number;
    latency: number;
    loss: number;
    stability: number;
  };
}

export interface Transmitter {
  id: string;
  name: string;
  callsign: string;
  frequency: number;
  type: 'VOR' | 'NDB' | 'AWOS' | 'Beacon' | 'DME' | string;
  coordinates: Coordinates;
  elevation: number;
  rangeNM: number;
  signal: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  lastUpdated: Date;
}

export interface Airport {
  id: string;
  code: string;
  name: string;
  coordinates: Coordinates;
  elevation: number;
  transmitters: Transmitter[];
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
    trafficTriggerKB: number;
  };
  normalization: {
    signalMin: number;
    signalMax: number;
    latencyMin: number;
    latencyMax: number;
    lossMax: number;
    stabilityWindow: number;
  };
  features: {
    assistedSwitching: boolean;
    bandwidthHeavyDetect: boolean;
    adaptiveScoring: boolean;
    backgroundMonitoring: boolean;
  };
  notifications: {
    alertOnCongestion: boolean;
  };
}

export interface Recommendation {
  currentAP: AccessPoint;
  recommendedAP: AccessPoint;
  reasons: string[];
  scoreDifference: number;
}
