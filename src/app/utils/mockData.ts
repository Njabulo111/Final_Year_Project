import { AccessPoint, NetworkMetrics, HistoricalData, Config, Transmitter, Airport, Coordinates } from '../types/wifi';

// Real airport data with transmitter locations (example: Frankfort area)
const REAL_AIRPORTS: Airport[] = [
  {
    id: 'fkr',
    code: 'FKR',
    name: 'Frankfort Capital City Airport',
    coordinates: { latitude: 38.7642, longitude: -84.8735 },
    elevation: 550,
    transmitters: [
      {
        id: 'fkr-awos',
        name: 'AWOS-3',
        callsign: 'FKR',
        frequency: 124.325,
        type: 'AWOS',
        coordinates: { latitude: 38.7642, longitude: -84.8735 },
        elevation: 550,
        rangeNM: 50,
        signal: -35,
        status: 'excellent',
        lastUpdated: new Date(),
      },
      {
        id: 'fkr-vor',
        name: 'Frankfort VOR',
        callsign: 'FKR',
        frequency: 111.4,
        type: 'VOR',
        coordinates: { latitude: 38.7642, longitude: -84.8735 },
        elevation: 550,
        rangeNM: 40,
        signal: -40,
        status: 'excellent',
        lastUpdated: new Date(),
      },
      {
        id: 'fkr-ndb',
        name: 'Frankfort NDB',
        callsign: 'FKR',
        frequency: 393,
        type: 'NDB',
        coordinates: { latitude: 38.7642, longitude: -84.8735 },
        elevation: 550,
        rangeNM: 25,
        signal: -45,
        status: 'good',
        lastUpdated: new Date(),
      },
    ],
  },
  {
    id: 'pasx',
    code: 'PASX',
    name: 'Soldotna Airport',
    coordinates: { latitude: 60.4837, longitude: -151.0404 },
    elevation: 90,
    transmitters: [
      {
        id: 'pasx-main',
        name: 'Soldotna Main',
        callsign: 'PASX',
        frequency: 122.5,
        type: 'AWOS',
        coordinates: { latitude: 60.4837, longitude: -151.0404 },
        elevation: 90,
        rangeNM: 30,
        signal: -32,
        status: 'excellent',
        lastUpdated: new Date(),
      },
      {
        id: 'longmere',
        name: 'Longmere Lake Transmitter',
        callsign: 'LGMR',
        frequency: 122.9,
        type: 'Beacon',
        coordinates: { latitude: 60.5200, longitude: -151.2300 },
        elevation: 200,
        rangeNM: 30,
        signal: -38,
        status: 'excellent',
        lastUpdated: new Date(),
      },
      {
        id: 'island-lake',
        name: 'Island Lake',
        callsign: 'ISLK',
        frequency: 122.7,
        type: 'Beacon',
        coordinates: { latitude: 60.5100, longitude: -150.9800 },
        elevation: 150,
        rangeNM: 30,
        signal: -40,
        status: 'good',
        lastUpdated: new Date(),
      },
      {
        id: 'kenai-class',
        name: 'Kenai Class D',
        callsign: 'KENAI',
        frequency: 121.3,
        type: 'Beacon',
        coordinates: { latitude: 60.4500, longitude: -151.2500 },
        elevation: 120,
        rangeNM: 30,
        signal: -42,
        status: 'good',
        lastUpdated: new Date(),
      },
    ],
  },
];

export function calculateScore(ap: Partial<AccessPoint>, config: Config): number {
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

export function getStatus(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

function calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (coord2.latitude - coord1.latitude) * Math.PI / 180;
  const dLon = (coord2.longitude - coord1.longitude) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1.latitude * Math.PI / 180) * Math.cos(coord2.latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function generateAccessPointsFromAirport(airport: Airport, userCoordinates: Coordinates, config: Config): AccessPoint[] {
  return airport.transmitters.map((transmitter, index) => {
    const signal = transmitter.signal + (Math.random() - 0.5) * 10;
    const latency = 5 + Math.random() * 25;
    const packetLoss = Math.random() * 2;
    const stability = 90 + Math.random() * 10;
    const distance = calculateDistance(userCoordinates, transmitter.coordinates) / transmitter.rangeNM;
    const signalQuality = Math.round(((signal + 85) / 40) * 100);
    const signalSpeed = Math.max(5, Math.round(20 + signalQuality * 4 + (Math.random() - 0.5) * 40));

    const subScores = {
      signal: signalQuality,
      latency: Math.round(100 - (latency / 50) * 100),
      loss: Math.round(100 - (packetLoss / 5) * 100),
      stability: Math.round(stability),
    };

    const ap: Partial<AccessPoint> = {
      signal,
      latency,
      packetLoss,
      stability,
      signalSpeed,
    };

    const score = calculateScore(ap, config);

    return {
      id: transmitter.id,
      ssid: transmitter.name,
      bssid: transmitter.callsign,
      channel: 1,
      frequency: transmitter.frequency,
      signal,
      signalQuality,
      signalSpeed,
      latency,
      packetLoss,
      stability,
      score,
      status: getStatus(score),
      isConnected: index === 0,
      position: {
        angle: (index / airport.transmitters.length) * 360,
        distance: Math.max(0, Math.min(1, distance)),
      },
      coordinates: transmitter.coordinates,
      rangeNM: transmitter.rangeNM,
      ip: `192.168.1.${10 + index}`,
      lastSeen: new Date(Date.now() - Math.random() * 10000),
      subScores,
    };
  });
}

export function generateMockAPs(config: Config): AccessPoint[] {
  const userCoordinates = { latitude: 38.7642, longitude: -84.8735 };
  const airport = REAL_AIRPORTS[0]; // Frankfort
  return generateAccessPointsFromAirport(airport, userCoordinates, config);
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
    signal: 0.35,
    latency: 0.30,
    loss: 0.20,
    stability: 0.15,
  },
  thresholds: {
    excellentScore: 85,
    goodScore: 75,
    fairScore: 50,
    recommendationThreshold: 15,
  },
  scanning: {
    intervalSeconds: 10,
    pingCount: 10,
    timeoutMs: 2000,
    trafficTriggerKB: 500,
  },
  normalization: {
    signalMin: -90,
    signalMax: -30,
    latencyMin: 10,
    latencyMax: 200,
    lossMax: 20,
    stabilityWindow: 5,
  },
  features: {
    assistedSwitching: true,
    bandwidthHeavyDetect: true,
    adaptiveScoring: true,
    backgroundMonitoring: false,
  },
  notifications: {
    alertOnCongestion: true,
  },
};

export interface SwitchEvent {
  id: string;
  timestamp: Date;
  fromLabel: string;
  toLabel: string;
  fromScore: number;
  toScore: number;
  improved: boolean;
}

export function generateMockSwitchEvents(count: number = 6): SwitchEvent[] {
  const events: SwitchEvent[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const fromScore = Math.round(35 + Math.random() * 55);
    const delta = Math.round((Math.random() - 0.35) * 45);
    const toScore = Math.max(0, Math.min(100, fromScore + delta));
    const apIndexFrom = Math.floor(Math.random() * 3) + 1;
    let apIndexTo = Math.floor(Math.random() * 3) + 1;
    if (apIndexTo === apIndexFrom) {
      apIndexTo = (apIndexTo % 3) + 1;
    }

    events.push({
      id: `switch-${i}`,
      timestamp: new Date(now - i * (45 + Math.random() * 90) * 60 * 1000),
      fromLabel: `AP-0${apIndexFrom}`,
      toLabel: `AP-0${apIndexTo}`,
      fromScore,
      toScore,
      improved: toScore > fromScore,
    });
  }

  return events;
}

export { REAL_AIRPORTS };
export function getAirportById(id: string): Airport | undefined {
  return REAL_AIRPORTS.find(airport => airport.id === id);
}

