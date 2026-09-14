import { registerPlugin, Capacitor, PluginListenerHandle } from '@capacitor/core';

export interface ScannedAp {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  frequency: number;
  isConnected: boolean;
}

export interface NetworkTestResult {
  latencyMs: number;
  packetLossPct: number;
  reachable: boolean;
}

export interface ConnectionInfo {
  rssi: number;
  linkSpeedMbps: number;
  gateway: string | null;
}

export interface SwitchResult {
  success: boolean;
}

export interface DownloadTestResult {
  success: boolean;
}

export interface PermissionStatus {
  location: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
  nearbyWifi: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
  notifications: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale';
}

export interface ScanLogEntry {
  ssid: string;
  bssid: string;
  rssi: number;
  latencyMs: number;
  packetLossPct: number;
  signalScore: number;
  latencyScore: number;
  lossScore: number;
  stabilityScore: number;
  totalScore: number;
  status: string;
}

export interface ResearchWeights {
  signal: number;
  latency: number;
  loss: number;
  stability: number;
  snr?: number;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  versionName?: string;
  releaseNotes?: string;
  downloadUrl?: string;
}

export interface PendingSwitchRecommendation {
  pending: boolean;
  targetSsid?: string;
  targetBssid?: string;
  currentSsid?: string;
  currentBssid?: string;
  targetScore?: number;
  currentScore?: number;
  targetStability?: number;
  currentStability?: number;
}

export interface ScanHistorySampleRow {
  timestamp: string;
  signalScore: number;
  latencyScore: number;
  lossScore: number;
  stabilityScore: number;
  totalScore: number;
}

export interface WifiMonitorPlugin {
  scanNetworks(): Promise<{ aps: ScannedAp[] }>;
  testNetwork(options?: { host?: string }): Promise<NetworkTestResult>;
  getConnectionInfo(): Promise<ConnectionInfo>;
  switchToBssid(options: { ssid: string; bssid: string }): Promise<SwitchResult>;
  testDownload(): Promise<DownloadTestResult>;
  logScan(entry: ScanLogEntry): Promise<void>;
  getScanHistoryCount(): Promise<{ count: number }>;
  getScanHistorySample(options?: { limit?: number }): Promise<{ rows: ScanHistorySampleRow[] }>;
  getResearchWeights(): Promise<ResearchWeights>;
  updateResearchWeight(options: { metric: string; weight: number; notes?: string }): Promise<void>;
  exportResearchData(): Promise<void>;
  startBackgroundMonitor(options?: { intervalSeconds?: number; congestionThreshold?: number }): Promise<void>;
  stopBackgroundMonitor(): Promise<void>;
  startTrafficWatch(options?: { thresholdKB?: number }): Promise<void>;
  stopTrafficWatch(): Promise<void>;
  getPendingSwitchRecommendation(): Promise<PendingSwitchRecommendation>;
  respondToSwitchRecommendation(options: { accepted: boolean; connectSucceeded?: boolean }): Promise<void>;
  checkForUpdate(): Promise<UpdateCheckResult>;
  downloadAndInstallUpdate(options: { downloadUrl: string }): Promise<void>;
  checkPermissions(): Promise<PermissionStatus>;
  requestPermissions(): Promise<PermissionStatus>;
  addListener(eventName: 'trafficSpike', listenerFunc: () => void): Promise<PluginListenerHandle>;
}

export const WifiMonitor = registerPlugin<WifiMonitorPlugin>('WifiMonitor');

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}
