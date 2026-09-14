import { WifiMonitor, isNative } from './nativeWifi';

const STORAGE_KEY = 'wifi-monitor-local-learning';

export interface LocalLearningRecord {
  timestamp: string;
  ssid: string;
  bssid: string;
  signal: number;
  latency: number;
  loss: number;
  stability: number;
  score: number;
}

async function readLocalSeed(): Promise<LocalLearningRecord[]> {
  const response = await fetch('/local-learning-data.json');
  if (!response.ok) {
    throw new Error(`Seed fetch failed: ${response.status}`);
  }
  return await response.json();
}

export interface LocalLearningStatus {
  sampleCount: number;
  weights: { signal: number; latency: number; loss: number; stability: number } | null;
}

export async function bootLocalLearningDataset(): Promise<LocalLearningStatus> {
  if (isNative()) {
    const [{ count }, weights] = await Promise.all([
      WifiMonitor.getScanHistoryCount(),
      WifiMonitor.getResearchWeights(),
    ]);
    return { sampleCount: count, weights };
  }

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    const records = JSON.parse(existing) as LocalLearningRecord[];
    return { sampleCount: records.length, weights: null };
  }

  const seed = await readLocalSeed();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return { sampleCount: seed.length, weights: null };
}
