import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Map as MapIcon, Layers, Info, LayoutList, X, Maximize2, Wifi, Signal, Radio } from 'lucide-react';
import { HeatmapData, getHeatmap } from '../services/apiClient';

type Hotspot = HeatmapData['ap_pixels'][number];

export function SiteSurvey() {
  const [heatmapData, setHeatmapData] = useState<HeatmapData | null>(null);
  const [activeLayer, setActiveLayer] = useState<'rssi' | 'snr' | 'overlap' | 'coverage'>('rssi');
  const [statusMessage, setStatusMessage] = useState('Loading heatmap...');
  const [selectedHotspot, setSelectedHotspot] = useState<Hotspot | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const loadHeatmap = async () => {
      setStatusMessage('Loading heatmap...');
      try {
        const data = await getHeatmap(activeLayer);
        setHeatmapData(data);
        setStatusMessage('');
      } catch (error) {
        console.warn('Heatmap API failed:', error);
        setHeatmapData(null);
        setStatusMessage('Heatmap data unavailable. Check backend connectivity.');
      }
    };

    loadHeatmap();
  }, [activeLayer]);

  useEffect(() => {
    drawToCanvas(canvasRef.current);
  }, [heatmapData, activeLayer]);

  useEffect(() => {
    if (!selectedHotspot) return;
    drawToCanvas(fullscreenCanvasRef.current, selectedHotspot.id, 2);
  }, [selectedHotspot, heatmapData, activeLayer]);

  const getColor = (value: number) => {
    if (activeLayer === 'overlap') {
      const intensity = Math.min(1, value / 6);
      return `rgba(220, 38, 38, ${0.2 + intensity * 0.55})`;
    }

    const { min_val = 0, max_val = 1 } = heatmapData || {};
    const ratio = max_val === min_val ? 0.5 : (value - min_val) / (max_val - min_val);
    const hue = 120 - Math.round(120 * ratio);
    return `hsla(${hue}, 72%, 55%, 0.75)`;
  };

  const drawToCanvas = (canvas: HTMLCanvasElement | null, highlightId?: string, scale = 1) => {
    if (!canvas || !heatmapData) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { grid, step, canvas_w, canvas_h, ap_pixels, walls_px } = heatmapData;

    canvas.width = canvas_w * scale;
    canvas.height = canvas_h * scale;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    ctx.clearRect(0, 0, canvas_w, canvas_h);

    for (let row = 0; row < grid.length; row += 1) {
      for (let col = 0; col < grid[row].length; col += 1) {
        const x = col * step;
        const y = row * step;
        ctx.fillStyle = getColor(grid[row][col]);
        ctx.fillRect(x, y, step, step);
      }
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas_w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas_h);
      ctx.stroke();
    }
    for (let y = 0; y <= canvas_h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas_w, y);
      ctx.stroke();
    }

    walls_px.forEach(([x1, y1, x2, y2]) => {
      ctx.strokeStyle = 'rgba(30, 64, 175, 0.8)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    ap_pixels.forEach((ap) => {
      const isHighlighted = highlightId === ap.id;

      if (isHighlighted) {
        ctx.beginPath();
        ctx.arc(ap.px, ap.py, 22, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(ap.px, ap.py, ap.is_connected ? 12 : 10, 0, Math.PI * 2);
      ctx.fillStyle = ap.is_connected ? '#2563eb' : '#1e40af';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'white';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(ap.ssid || ap.label, ap.px, ap.py - 14);
    });
  };

  const findHotspotAt = (canvas: HTMLCanvasElement, clientX: number, clientY: number): Hotspot | null => {
    if (!heatmapData) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = heatmapData.canvas_w / rect.width;
    const scaleY = heatmapData.canvas_h / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    let closest: Hotspot | null = null;
    let closestDist = Infinity;

    for (const ap of heatmapData.ap_pixels) {
      const dist = Math.hypot(ap.px - x, ap.py - y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = ap;
      }
    }

    return closestDist <= 24 ? closest : null;
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const hotspot = findHotspotAt(event.currentTarget, event.clientX, event.clientY);
    if (hotspot) setSelectedHotspot(hotspot);
  };

  const getDisplayStatus = () => {
    if (!heatmapData) return statusMessage;
    return `${heatmapData.total_aps} APs • ${heatmapData.coverage_pct}% coverage`;
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'excellent':
        return 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20';
      case 'good':
        return 'text-blue-600 bg-blue-500/10 border-blue-500/20';
      case 'fair':
        return 'text-amber-600 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-rose-600 bg-rose-500/10 border-rose-500/20';
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))] p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[rgb(var(--color-foreground))] flex items-center gap-2">
            <MapIcon className="text-blue-500" />
            RF Site Survey
          </h2>
          <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60">
            Professional heatmap and coverage visualization
          </p>
        </div>

        <div className="flex bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-lg p-1 overflow-x-auto no-scrollbar">
          {(['rssi', 'snr', 'overlap', 'coverage'] as const).map((layer) => (
            <button
              key={layer}
              onClick={() => setActiveLayer(layer)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                activeLayer === layer
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-[rgb(var(--color-foreground))] opacity-60 hover:opacity-100'
              }`}
            >
              {layer.toUpperCase()}
            </button>
          ))}
        </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.65fr] gap-4 md:gap-6">
        <motion.div
          className="lg:col-span-3 bg-white border border-[rgb(var(--color-border))] rounded-xl shadow-sm overflow-hidden relative"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Layers size={16} className="text-blue-500" />
              {activeLayer.toUpperCase()} Heatmap
            </div>
            <div className="flex items-center gap-3">
              {heatmapData && (
                <span className="hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-gray-400">
                  <Maximize2 size={12} />
                  Tap a hotspot to inspect
                </span>
              )}
              <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400">
                {getDisplayStatus()}
              </div>
            </div>
          </div>

          <div className="relative aspect-[16/9] w-full overflow-hidden flex items-center justify-center bg-slate-50">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="max-w-full h-auto w-full cursor-pointer"
            />
            {!heatmapData && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10 text-sm text-white">
                {statusMessage}
              </div>
            )}
          </div>
        </motion.div>

        <div className="space-y-6">
          <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[rgb(var(--color-foreground))] mb-4 flex items-center gap-2">
              <Info size={16} className="text-blue-500" />
              Layer Insights
            </h3>
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs font-bold text-blue-800 mb-1">Coverage Analysis</p>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  The backend heatmap uses calibrated AP positions and signal strength to estimate coverage and interference.
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                <p className="text-xs font-bold text-orange-800 mb-1">Detected Interference</p>
                <p className="text-[11px] text-orange-700 leading-relaxed">
                  Overlapping channels and poor RSSI zones are highlighted automatically using live scan results.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-[rgb(var(--color-foreground))] mb-4 flex items-center gap-2">
              <LayoutList size={16} className="text-blue-500" />
              AP Inspector
            </h3>
            {heatmapData && heatmapData.ap_pixels.length > 0 ? (
              <div className="space-y-2">
                {heatmapData.ap_pixels.map((ap) => (
                  <button
                    key={ap.id}
                    onClick={() => setSelectedHotspot(ap)}
                    className="w-full flex items-center justify-between gap-2 rounded-lg border border-[rgb(var(--color-border))] px-3 py-2 text-left hover:bg-[rgb(var(--color-muted))] transition-colors"
                  >
                    <span className="min-w-0 truncate text-sm text-[rgb(var(--color-foreground))]">{ap.ssid || ap.label}</span>
                    <span className="shrink-0 text-xs font-semibold text-blue-600">{ap.rssi} dBm</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
                The location of each AP is derived from configured lab positions and live scan data.
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedHotspot && (
          <motion.div
            className="fixed inset-0 z-[100] bg-black flex flex-col"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{selectedHotspot.ssid || selectedHotspot.label}</p>
                <p className="text-white/50 text-xs font-mono truncate">{selectedHotspot.id}</p>
              </div>
              <button
                onClick={() => setSelectedHotspot(null)}
                className="shrink-0 p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Close hotspot view"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 flex items-center justify-center overflow-auto p-2">
              <canvas ref={fullscreenCanvasRef} className="max-w-full max-h-full" />
            </div>

            <div className="border-t border-white/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1">
                  <Signal size={12} />
                  Signal
                </div>
                <div className="text-white font-bold">{selectedHotspot.rssi} dBm</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1">
                  <Radio size={12} />
                  Channel
                </div>
                <div className="text-white font-bold">{selectedHotspot.channel} • {selectedHotspot.band}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-3">
                <div className="flex items-center gap-1.5 text-white/50 text-[11px] uppercase tracking-wide mb-1">
                  <Wifi size={12} />
                  Score
                </div>
                <div className="text-white font-bold">{selectedHotspot.score}/100</div>
              </div>
              <div className={`rounded-xl border p-3 ${statusColor(selectedHotspot.status)}`}>
                <div className="text-[11px] uppercase tracking-wide mb-1 opacity-70">Status</div>
                <div className="font-bold capitalize">
                  {selectedHotspot.status}{selectedHotspot.is_connected ? ' • Connected' : ''}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
