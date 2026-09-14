import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, RotateCcw } from 'lucide-react';
import { Config } from '../types/wifi';
import { defaultConfig } from '../utils/mockData';
import * as Slider from '@radix-ui/react-slider';
import { toast } from 'sonner';

export function Settings() {
  const [config, setConfig] = useState<Config>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const updateWeight = (key: keyof Config['weights'], value: number) => {
    setConfig(prev => ({ ...prev, weights: { ...prev.weights, [key]: value / 100 } }));
    setHasChanges(true);
  };

  const handleSave = () => {
    toast.success('Settings saved successfully!');
    setHasChanges(false);
  };

  const handleReset = () => {
    setConfig(defaultConfig);
    setHasChanges(false);
    toast.info('Settings reset to defaults');
  };

  const weightSum = Object.values(config.weights).reduce((sum, w) => sum + w, 0);
  const isValidWeights = Math.abs(weightSum - 1) < 0.01;

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))]">Configuration</h2>
          <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">Customize scoring algorithm parameters</p>
        </div>

        <div className="flex gap-3">
          <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg text-[rgb(var(--color-foreground))] hover:border-orange-500 transition-colors">
            <RotateCcw size={18} />
            <span className="text-sm font-medium">Reset</span>
          </button>

          <button onClick={handleSave} disabled={!hasChanges || !isValidWeights} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${hasChanges && isValidWeights ? 'bg-blue-500 text-white hover:bg-blue-600' : 'bg-[rgb(var(--color-muted))] text-[rgb(var(--color-foreground))] opacity-50 cursor-not-allowed'}`}>
            <Save size={18} />
            <span>Save Changes</span>
          </button>
        </div>
      </div>

      <motion.div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-6 shadow-sm" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h3 className="text-lg font-semibold text-[rgb(var(--color-foreground))] mb-6">Score Weights</h3>

        <div className="space-y-6">
          {[
            { key: 'signal' as const, label: 'Signal Strength', color: '#10b981' },
            { key: 'latency' as const, label: 'Latency', color: '#3b82f6' },
            { key: 'loss' as const, label: 'Packet Loss', color: '#f59e0b' },
            { key: 'stability' as const, label: 'Stability', color: '#8b5cf6' },
          ].map(({ key, label, color }) => {
            const value = config.weights[key] * 100;
            return (
              <div key={key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[rgb(var(--color-foreground))]">{label}</span>
                  <span className="text-2xl font-bold text-[rgb(var(--color-foreground))]">{value.toFixed(0)}%</span>
                </div>

                <Slider.Root className="relative flex items-center select-none touch-none w-full h-5" value={[value]} onValueChange={([val]) => updateWeight(key, val)} max={100} step={1}>
                  <Slider.Track className="bg-[rgb(var(--color-muted))] relative grow rounded-full h-3">
                    <Slider.Range className="absolute rounded-full h-full" style={{ backgroundColor: color }} />
                  </Slider.Track>
                  <Slider.Thumb className="block w-5 h-5 bg-white border-2 rounded-full shadow-lg hover:scale-110 focus:outline-none transition-transform" style={{ borderColor: color }} />
                </Slider.Root>
              </div>
            );
          })}
        </div>

        <div className={`mt-6 p-4 rounded-lg ${isValidWeights ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}`}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[rgb(var(--color-foreground))]">Total Weight Sum</span>
            <span className={`text-lg font-bold ${isValidWeights ? 'text-green-600' : 'text-red-600'}`}>{(weightSum * 100).toFixed(0)}%</span>
          </div>
          {!isValidWeights && <p className="text-sm text-red-600 mt-2">Weights must sum to 100%</p>}
        </div>
      </motion.div>
    </div>
  );
}
