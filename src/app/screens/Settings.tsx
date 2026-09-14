import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Save, RotateCcw, ChevronRight, Download } from 'lucide-react';
import { Config } from '../types/wifi';
import { defaultConfig } from '../utils/mockData';
import { loadConfig, saveConfig, resetConfig } from '../services/settingsStorage';
import { WifiMonitor, isNative } from '../services/nativeWifi';
import { Switch } from '../components/ui/switch';
import * as Slider from '@radix-ui/react-slider';
import { toast } from 'sonner';

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </p>
  );
}

function LabeledSlider({
  label,
  valueLabel,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  valueLabel: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-sm text-muted-foreground">{valueLabel}</span>
      </div>
      <Slider.Root
        className="relative flex h-5 w-full touch-none select-none items-center"
        value={[value]}
        onValueChange={([val]) => onChange(val)}
        min={min}
        max={max}
        step={step}
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-border-hairline">
          <Slider.Range className="absolute h-full rounded-full bg-accent-signal" />
        </Slider.Track>
        <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-accent-signal bg-background shadow transition-transform hover:scale-110 focus:outline-none" />
      </Slider.Root>
    </div>
  );
}

function FeatureToggle({
  label,
  subtext,
  checked,
  onCheckedChange,
}: {
  label: string;
  subtext: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="data-[state=checked]:bg-accent-signal"
      />
    </div>
  );
}

export function Settings() {
  const [config, setConfig] = useState<Config>(loadConfig);
  const [hasChanges, setHasChanges] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const update = (updater: (prev: Config) => Config) => {
    setConfig(updater);
    setHasChanges(true);
  };

  const handleToggleBackgroundMonitoring = async (checked: boolean) => {
    update((prev) => ({ ...prev, features: { ...prev.features, backgroundMonitoring: checked } }));
    saveConfig({ ...config, features: { ...config.features, backgroundMonitoring: checked } });

    if (!isNative()) return;

    try {
      if (checked) {
        await WifiMonitor.startBackgroundMonitor({
          intervalSeconds: config.scanning.intervalSeconds,
          congestionThreshold: config.thresholds.fairScore,
        });
        toast.success('Background monitoring enabled');
      } else {
        await WifiMonitor.stopBackgroundMonitor();
        toast.info('Background monitoring disabled');
      }
    } catch (error) {
      toast.error('Could not change background monitoring — check notification permission.');
    }
  };

  const handleExportResearchData = async () => {
    if (!isNative()) {
      toast.info('Research data export requires the Android app.');
      return;
    }

    setIsExporting(true);
    try {
      await WifiMonitor.exportResearchData();
    } catch (error) {
      toast.error('Export failed — no scan data logged yet?');
    } finally {
      setIsExporting(false);
    }
  };

  const updateWeight = (key: keyof Config['weights'], value: number) => {
    update((prev) => ({ ...prev, weights: { ...prev.weights, [key]: value / 100 } }));
  };

  const handleSave = () => {
    saveConfig(config);
    toast.success('Settings saved successfully!');
    setHasChanges(false);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setHasChanges(true);
    toast.info('Settings reset to defaults');
  };

  const handleResetAllData = () => {
    if (!window.confirm('Reset all data? This clears your saved settings and cannot be undone.')) {
      return;
    }
    resetConfig();
    Object.keys(localStorage)
      .filter((key) => key.startsWith('wifi-monitor-last-notified-'))
      .forEach((key) => localStorage.removeItem(key));
    setConfig(defaultConfig);
    setHasChanges(false);
    toast.success('All data has been reset');
  };

  const weightSum = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
  const isValidWeights = Math.abs(weightSum - 1) < 0.01;

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Settings</h2>
          <p className="text-sm text-muted-foreground">Customize scanning, scoring, and alerts</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 rounded-lg border border-border-hairline bg-surface-card px-4 py-2 text-foreground transition-colors hover:border-status-moderate"
          >
            <RotateCcw size={18} />
            <span className="text-sm font-medium">Reset</span>
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || !isValidWeights}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              hasChanges && isValidWeights
                ? 'bg-accent-signal text-background hover:opacity-90'
                : 'cursor-not-allowed bg-muted text-muted-foreground'
            }`}
          >
            <Save size={18} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <SectionEyebrow>Scanning</SectionEyebrow>
        <LabeledSlider
          label="Scan interval"
          valueLabel={`${config.scanning.intervalSeconds}s`}
          value={config.scanning.intervalSeconds}
          min={5}
          max={60}
          step={5}
          onChange={(val) => update((prev) => ({ ...prev, scanning: { ...prev.scanning, intervalSeconds: val } }))}
        />
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
      >
        <SectionEyebrow>Scoring</SectionEyebrow>
        <div className="space-y-5">
          {[
            { key: 'signal' as const, label: 'Signal Strength' },
            { key: 'latency' as const, label: 'Latency' },
            { key: 'loss' as const, label: 'Packet Loss' },
            { key: 'stability' as const, label: 'Stability' },
          ].map(({ key, label }) => (
            <LabeledSlider
              key={key}
              label={label}
              valueLabel={`${(config.weights[key] * 100).toFixed(0)}%`}
              value={config.weights[key] * 100}
              min={0}
              max={100}
              step={1}
              onChange={(val) => updateWeight(key, val)}
            />
          ))}
        </div>

        <div
          className={`mt-5 rounded-lg p-4 ${
            isValidWeights ? 'bg-status-good/10 border border-status-good/20' : 'bg-status-congested/10 border border-status-congested/20'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">Total Weight Sum</span>
            <span className={`text-lg font-bold ${isValidWeights ? 'text-status-good' : 'text-status-congested'}`}>
              {(weightSum * 100).toFixed(0)}%
            </span>
          </div>
          {!isValidWeights && <p className="mt-2 text-sm text-status-congested">Weights must sum to 100%</p>}
        </div>
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <SectionEyebrow>Features</SectionEyebrow>
        <div className="divide-y divide-border-hairline">
          <FeatureToggle
            label="Assisted AP switching"
            subtext="Suggest better APs"
            checked={config.features.assistedSwitching}
            onCheckedChange={(checked) =>
              update((prev) => ({ ...prev, features: { ...prev.features, assistedSwitching: checked } }))
            }
          />
          <FeatureToggle
            label="Bandwidth-heavy detection"
            subtext="Rescan on traffic spikes"
            checked={config.features.bandwidthHeavyDetect}
            onCheckedChange={(checked) =>
              update((prev) => ({ ...prev, features: { ...prev.features, bandwidthHeavyDetect: checked } }))
            }
          />
          <FeatureToggle
            label="Adaptive scoring"
            subtext="Learn from your usage"
            checked={config.features.adaptiveScoring}
            onCheckedChange={(checked) =>
              update((prev) => ({ ...prev, features: { ...prev.features, adaptiveScoring: checked } }))
            }
          />
          <FeatureToggle
            label="Background monitoring"
            subtext="Keep watching your connection when the app is closed, with a persistent notification"
            checked={config.features.backgroundMonitoring}
            onCheckedChange={handleToggleBackgroundMonitoring}
          />
        </div>
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <SectionEyebrow>Thresholds</SectionEyebrow>
        <div className="space-y-5">
          <LabeledSlider
            label="Switch sensitivity"
            valueLabel={`${config.thresholds.recommendationThreshold}%`}
            value={config.thresholds.recommendationThreshold}
            min={5}
            max={50}
            step={5}
            onChange={(val) =>
              update((prev) => ({ ...prev, thresholds: { ...prev.thresholds, recommendationThreshold: val } }))
            }
          />
          <LabeledSlider
            label="Traffic trigger"
            valueLabel={`${config.scanning.trafficTriggerKB}KB`}
            value={config.scanning.trafficTriggerKB}
            min={100}
            max={2000}
            step={50}
            onChange={(val) => update((prev) => ({ ...prev, scanning: { ...prev.scanning, trafficTriggerKB: val } }))}
          />
        </div>
      </motion.div>

      <motion.div
        className="rounded-2xl border border-border-hairline bg-surface-card p-5"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <SectionEyebrow>Notifications</SectionEyebrow>
        <FeatureToggle
          label="Alert on congestion"
          subtext="Show an in-app alert when your connection becomes congested"
          checked={config.notifications.alertOnCongestion}
          onCheckedChange={(checked) =>
            update((prev) => ({ ...prev, notifications: { ...prev.notifications, alertOnCongestion: checked } }))
          }
        />
      </motion.div>

      <div className="divide-y divide-border-hairline overflow-hidden rounded-2xl border border-border-hairline bg-surface-card">
        <Link to="/about" className="flex items-center justify-between px-5 py-4 text-sm text-foreground hover:bg-muted">
          About this app
          <ChevronRight size={16} className="text-muted-foreground" />
        </Link>
        <Link to="/privacy" className="flex items-center justify-between px-5 py-4 text-sm text-foreground hover:bg-muted">
          Privacy Policy
          <ChevronRight size={16} className="text-muted-foreground" />
        </Link>
        <button
          onClick={handleExportResearchData}
          disabled={isExporting}
          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-foreground hover:bg-muted disabled:opacity-60"
        >
          <span className="flex items-center gap-2">
            <Download size={16} className="text-muted-foreground" />
            {isExporting ? 'Preparing export…' : 'Export research data'}
          </span>
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
        <button
          onClick={handleResetAllData}
          className="flex w-full items-center justify-between px-5 py-4 text-left text-sm text-status-congested hover:bg-status-congested/5"
        >
          Reset all data
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
