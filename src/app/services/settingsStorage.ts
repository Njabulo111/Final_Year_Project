import { Config } from '../types/wifi';
import { defaultConfig } from '../utils/mockData';

const STORAGE_KEY = 'wifi-monitor-config';

export function loadConfig(): Config {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultConfig;

    const stored = JSON.parse(raw) as Partial<Config>;
    return {
      weights: { ...defaultConfig.weights, ...stored.weights },
      thresholds: { ...defaultConfig.thresholds, ...stored.thresholds },
      scanning: { ...defaultConfig.scanning, ...stored.scanning },
      normalization: { ...defaultConfig.normalization, ...stored.normalization },
      features: { ...defaultConfig.features, ...stored.features },
      notifications: { ...defaultConfig.notifications, ...stored.notifications },
    };
  } catch (error) {
    console.warn('Failed to load saved settings, using defaults:', error);
    return defaultConfig;
  }
}

export function saveConfig(config: Config): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function resetConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}
