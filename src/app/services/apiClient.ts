import { AccessPoint } from '../types/wifi';
import { WifiMonitor, isNative } from './nativeWifi';
import { calculateScore, getStatus } from '../utils/mockData';
import { loadConfig } from './settingsStorage';
import { appendHistoryRow, readHistoryRows } from './historyStore';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface BackendAP {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  frequency: number;
  band: string;
  is_connected: boolean;
  latency_ms?: number;
  loss_pct?: number;
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'poor';
  colour?: string;
}

export interface LatestDataResponse {
  aps: BackendAP[];
  recommendation: string;
  timestamp: string;
  scan_count: number;
  nav_message: string;
  nav_target_bssid: string;
  connected_ssid?: string;
  connected_bssid?: string;
}

export interface HistoryRow {
  id: number;
  timestamp: string;
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  band: string;
  is_connected: number;
  latency_ms: number | null;
  loss_pct: number | null;
  score: number;
  status: string;
  recommendation: string | null;
}

export interface HeatmapData {
  grid: number[][];
  step: number;
  canvas_w: number;
  canvas_h: number;
  layer: string;
  min_val: number;
  max_val: number;
  ap_pixels: Array<{
    id: string;
    label: string;
    ssid: string;
    px: number;
    py: number;
    rssi: number;
    channel: number;
    band: string;
    score: number;
    status: string;
    is_connected: boolean;
  }>;
  walls_px: number[][];
  dead_zones: number;
  coverage_pct: number;
  total_aps: number;
}

function normalizeSignalQuality(rssi: number): number {
  return Math.max(0, Math.min(100, Math.round((rssi + 100) * 1.25)));
}

function buildPosition(index: number, total: number): { angle: number; distance: number } {
  const angle = (index / Math.max(1, total)) * 360;
  const distance = Math.max(0.15, Math.min(0.95, 1 - normalizeSignalQuality(-100 + index * 5) / 120));
  return { angle, distance };
}

function backendAPToAccessPoint(ap: BackendAP, index: number, total: number): AccessPoint {
  const signalQuality = normalizeSignalQuality(ap.rssi);
  const latency = ap.latency_ms ?? 0;
  const packetLoss = ap.loss_pct ?? 0;
  const stability = 90;

  return {
    id: ap.bssid || `${ap.ssid}-${index}`,
    ssid: ap.ssid,
    bssid: ap.bssid,
    channel: ap.channel,
    frequency: ap.frequency,
    signal: ap.rssi,
    signalQuality,
    latency,
    packetLoss,
    stability,
    score: ap.score,
    status: ap.status,
    isConnected: ap.is_connected,
    position: buildPosition(index, total),
    coordinates: { latitude: 0, longitude: 0 },
    rangeNM: 1,
    signalSpeed: Math.max(1, Math.round(5 + signalQuality * 0.5)),
    lastSeen: new Date(),
    ip: ap.bssid || ap.ssid,
    subScores: {
      signal: signalQuality,
      latency: Math.max(0, Math.min(100, Math.round(100 - latency / 2))),
      loss: Math.max(0, Math.min(100, Math.round(100 - packetLoss * 5))),
      stability,
    },
  };
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function createFallbackHeatmapData(layer: string): HeatmapData {
  const rows = 24;
  const cols = 40;
  const step = 8;
  const canvas_w = cols * step;
  const canvas_h = rows * step;

  const grid = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: cols }, (_, col) => {
      const corridor = col > 10 && col < 30 ? 4 : 0;
      const signal = -72 - row * 0.4 + corridor - Math.abs(col - 20) * 0.18;
      const overlap = Math.max(0, Math.min(4, Math.round((50 - Math.abs(col - 20)) / 10)));
      if (layer === 'snr') return Math.round((signal + 18) * 10) / 10;
      if (layer === 'overlap') return overlap;
      if (layer === 'coverage') return Math.round(Math.max(-100, Math.min(-40, signal)) * 10) / 10;
      return Math.round(signal * 10) / 10;
    })
  );

  const min_val = Math.min(...grid.map(row => Math.min(...row)));
  const max_val = Math.max(...grid.map(row => Math.max(...row)));
  const covered = grid.flat().filter(value => value >= -70).length;

  return {
    grid,
    step,
    canvas_w,
    canvas_h,
    layer,
    min_val,
    max_val,
    ap_pixels: [
      {
        id: 'demo-ap-1',
        label: 'Demo AP 1',
        ssid: 'UoJ Lab WiFi',
        px: 110,
        py: 120,
        rssi: -58,
        channel: 1,
        band: '2.4GHz',
        score: 94,
        status: 'excellent',
        is_connected: true,
      },
      {
        id: 'demo-ap-2',
        label: 'Demo AP 2',
        ssid: 'UoJ Lab WiFi',
        px: 400,
        py: 150,
        rssi: -64,
        channel: 6,
        band: '5GHz',
        score: 88,
        status: 'good',
        is_connected: false,
      },
      {
        id: 'demo-ap-3',
        label: 'Demo AP 3',
        ssid: 'UoJ Lab WiFi',
        px: 260,
        py: 270,
        rssi: -70,
        channel: 11,
        band: '2.4GHz',
        score: 80,
        status: 'fair',
        is_connected: false,
      },
    ],
    walls_px: [
      [120, 40, 120, 320],
      [340, 40, 340, 320],
      [120, 140, 340, 140],
    ],
    dead_zones: Math.max(0, grid.flat().filter(value => value < -85).length),
    coverage_pct: Math.round((covered / (rows * cols)) * 100),
    total_aps: 3,
  };
}

async function getNativeLatestData(): Promise<LatestDataResponse> {
  const { aps: scanned } = await WifiMonitor.scanNetworks();
  const connected = scanned.find((ap) => ap.isConnected);
  const testResult = connected
    ? await WifiMonitor.testNetwork()
    : { latencyMs: 0, packetLossPct: 0, reachable: true };

  const config = loadConfig();

  const aps: BackendAP[] = scanned.map((ap) => {
    const isConnectedAp = ap.isConnected;
    const latencyMs = isConnectedAp ? testResult.latencyMs : undefined;
    const lossPct = isConnectedAp ? testResult.packetLossPct : undefined;
    const score = calculateScore(
      { signal: ap.rssi, latency: latencyMs, packetLoss: lossPct },
      config,
    );

    return {
      ssid: ap.ssid,
      bssid: ap.bssid,
      rssi: ap.rssi,
      channel: ap.channel,
      frequency: ap.frequency,
      band: ap.frequency >= 5000 ? '5GHz' : '2.4GHz',
      is_connected: ap.isConnected,
      latency_ms: latencyMs,
      loss_pct: lossPct,
      score,
      status: getStatus(score),
    };
  });

  const now = new Date().toISOString();

  if (connected) {
    const connectedResult = aps.find((ap) => ap.bssid === connected.bssid);
    appendHistoryRow({
      id: Date.now(),
      timestamp: now,
      ssid: connected.ssid,
      bssid: connected.bssid,
      rssi: connected.rssi,
      channel: connected.channel,
      band: connected.frequency >= 5000 ? '5GHz' : '2.4GHz',
      is_connected: 1,
      latency_ms: testResult.latencyMs,
      loss_pct: testResult.packetLossPct,
      score: connectedResult?.score ?? 0,
      status: connectedResult?.status ?? 'fair',
      recommendation: null,
    });

    const normalizedLatencyScore = Math.max(0, Math.min(100, Math.round(100 - testResult.latencyMs / 2)));
    const normalizedLossScore = Math.max(0, Math.min(100, Math.round(100 - testResult.packetLossPct * 5)));
    const signalScore = Math.max(0, Math.min(100, Math.round((connected.rssi + 100) * 1.25)));

    WifiMonitor.logScan({
      ssid: connected.ssid,
      bssid: connected.bssid,
      rssi: connected.rssi,
      latencyMs: testResult.latencyMs,
      packetLossPct: testResult.packetLossPct,
      signalScore,
      latencyScore: normalizedLatencyScore,
      lossScore: normalizedLossScore,
      stabilityScore: 95,
      totalScore: connectedResult?.score ?? 0,
      status: connectedResult?.status ?? 'fair',
    }).catch(() => {
      // best-effort research logging; never block the live scan on this
    });
  }

  return {
    aps,
    recommendation: '',
    timestamp: now,
    scan_count: aps.length,
    nav_message: '',
    nav_target_bssid: '',
    connected_ssid: connected?.ssid,
    connected_bssid: connected?.bssid,
  };
}

export async function getLatestData() {
  if (isNative()) {
    return await getNativeLatestData();
  }
  return await fetchJson<LatestDataResponse>(`${API_BASE_URL}/data`);
}

export async function getHistory(limit = 48) {
  if (isNative()) {
    return readHistoryRows(limit);
  }
  return await fetchJson<HistoryRow[]>(`${API_BASE_URL}/history?limit=${limit}`);
}

async function getNativeHeatmap(layer: string): Promise<HeatmapData> {
  const { aps: scanned } = await WifiMonitor.scanNetworks();
  if (scanned.length === 0) {
    return createFallbackHeatmapData(layer);
  }

  const config = loadConfig();
  const rows = 24;
  const cols = 40;
  const step = 8;
  const canvas_w = cols * step;
  const canvas_h = rows * step;
  const centerX = canvas_w / 2;
  const centerY = canvas_h / 2;
  const radius = Math.min(canvas_w, canvas_h) * 0.42;

  const points = scanned.map((ap, index) => {
    const { angle, distance } = buildPosition(index, scanned.length);
    const angleRad = (angle * Math.PI) / 180;
    return {
      ap,
      px: centerX + Math.cos(angleRad) * radius * distance,
      py: centerY + Math.sin(angleRad) * radius * distance,
    };
  });

  const idwRssiAt = (x: number, y: number): { rssi: number; weightSum: number; nearCount: number } => {
    let weightedSum = 0;
    let weightSum = 0;
    let nearCount = 0;

    for (const point of points) {
      const dx = x - point.px;
      const dy = y - point.py;
      const distSq = dx * dx + dy * dy;
      const weight = 1 / (distSq + 40);
      weightedSum += point.ap.rssi * weight;
      weightSum += weight;
      if (weight > 0.01) nearCount += 1;
    }

    return { rssi: weightSum > 0 ? weightedSum / weightSum : -100, weightSum, nearCount };
  };

  const grid: number[][] = [];
  for (let row = 0; row < rows; row += 1) {
    const gridRow: number[] = [];
    for (let col = 0; col < cols; col += 1) {
      const x = col * step + step / 2;
      const y = row * step + step / 2;
      const { rssi, nearCount } = idwRssiAt(x, y);

      if (layer === 'snr') {
        gridRow.push(Math.round((rssi + 95) * 10) / 10);
      } else if (layer === 'overlap') {
        gridRow.push(Math.max(0, nearCount - 1));
      } else if (layer === 'coverage') {
        gridRow.push(Math.round(Math.max(-100, Math.min(-40, rssi)) * 10) / 10);
      } else {
        gridRow.push(Math.round(rssi * 10) / 10);
      }
    }
    grid.push(gridRow);
  }

  const flatValues = grid.flat();
  const min_val = Math.min(...flatValues);
  const max_val = Math.max(...flatValues);
  const covered = flatValues.filter((value) => value >= -70).length;
  const deadZones = flatValues.filter((value) => value < -85).length;

  const connectedBssid = scanned.find((ap) => ap.isConnected)?.bssid;

  const ap_pixels = points.map(({ ap, px, py }) => {
    const band = ap.frequency >= 5000 ? '5GHz' : '2.4GHz';
    const score = calculateScore({ signal: ap.rssi, latency: 0, packetLoss: 0 }, config);
    return {
      id: ap.bssid,
      label: ap.ssid || ap.bssid,
      ssid: ap.ssid,
      px,
      py,
      rssi: ap.rssi,
      channel: ap.channel,
      band,
      score,
      status: getStatus(score),
      is_connected: ap.bssid === connectedBssid,
    };
  });

  return {
    grid,
    step,
    canvas_w,
    canvas_h,
    layer,
    min_val,
    max_val,
    ap_pixels,
    walls_px: [],
    dead_zones: deadZones,
    coverage_pct: Math.round((covered / (rows * cols)) * 100),
    total_aps: scanned.length,
  };
}

export async function getHeatmap(layer = 'rssi') {
  if (isNative()) {
    return await getNativeHeatmap(layer);
  }
  try {
    return await fetchJson<HeatmapData>(`${API_BASE_URL}/heatmap?layer=${layer}`);
  } catch (error) {
    console.warn('Falling back to demo heatmap data:', error);
    return createFallbackHeatmapData(layer);
  }
}

export function mapBackendAps(aps: BackendAP[]): AccessPoint[] {
  return aps.map((ap, index) => backendAPToAccessPoint(ap, index, aps.length));
}

export function mapHistoryRows(rows: HistoryRow[]) {
  return rows.map(row => ({
    ...row,
    timestamp: new Date(row.timestamp),
  }));
}
