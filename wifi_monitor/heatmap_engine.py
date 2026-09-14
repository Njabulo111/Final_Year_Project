import json
import math
import os
from typing import List, Dict, Any

import numpy as np
import pandas as pd

import config
from interpolation import idw_interpolate, coverage_mask as compute_coverage_mask


def _load_path_loss_calibration() -> Dict[str, Dict[str, float]]:
    path = getattr(config, 'PATH_LOSS_CALIBRATION_FILE', None)
    if not path or not os.path.exists(path):
        return {}
    try:
        with open(path) as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return {}


def _load_calibration_points() -> 'pd.DataFrame | None':
    path = getattr(config, 'CALIBRATION_POINTS_FILE', None)
    min_samples = getattr(config, 'MIN_CALIBRATION_SAMPLES', 5)
    if not path or not os.path.exists(path):
        return None
    try:
        df = pd.read_csv(path)
    except (pd.errors.EmptyDataError, OSError):
        return None
    if len(df) < min_samples:
        return None
    return df


def metres_to_pixels(x_m: float, y_m: float) -> tuple:
    canvas_w = 680
    canvas_h = 400
    px_per_m_x = canvas_w / config.FLOOR_WIDTH_M
    px_per_m_y = canvas_h / config.FLOOR_HEIGHT_M
    return (round(x_m * px_per_m_x), round(y_m * px_per_m_y))


def pixels_to_metres(px: int, py: int) -> tuple:
    canvas_w = 680
    canvas_h = 400
    x_m = px * (config.FLOOR_WIDTH_M / canvas_w)
    y_m = py * (config.FLOOR_HEIGHT_M / canvas_h)
    return (round(x_m, 2), round(y_m, 2))


def rssi_at_point(ap_x_m: float, ap_y_m: float, ap_rssi_1m: float,
                  px_m: float, py_m: float, n: float = None) -> float:
    if n is None:
        n = config.PATH_LOSS_EXPONENT
    dx = px_m - ap_x_m
    dy = py_m - ap_y_m
    d  = math.sqrt(dx*dx + dy*dy)
    if d < 0.1:
        d = 0.1
    rssi = ap_rssi_1m - 10.0 * n * math.log10(d)
    return max(-100.0, min(-10.0, rssi))


def _theoretical_best_rssi(x_m: float, y_m: float, enriched_aps: list, calibration: Dict[str, Dict[str, float]]) -> float:
    """Strongest theoretical RSSI across all known APs at a point, using each
    AP's calibrated (n, rssi_at_1m) when available, config defaults otherwise."""
    best = -999.0
    for ap in enriched_aps:
        cal = calibration.get(ap.get('bssid', ''), {})
        n = cal.get('n', config.PATH_LOSS_EXPONENT)
        rssi_1m = cal.get('rssi_at_1m', config.RSSI_AT_1M)
        r = rssi_at_point(ap['x_m'], ap['y_m'], rssi_1m, x_m, y_m, n) - wall_attenuation(ap['x_m'], ap['y_m'], x_m, y_m)
        if r > best:
            best = r
    return best


def wall_attenuation(ap_x_m: float, ap_y_m: float,
                     px_m: float, py_m: float) -> float:
    atten_per_wall = config.WALL_ATTENUATION.get(config.DEFAULT_WALL_TYPE, 4)
    total = 0.0
    for wall in getattr(config, 'INTERNAL_WALLS', []):
        x1, y1, x2, y2 = wall
        if _lines_intersect(ap_x_m, ap_y_m, px_m, py_m, x1, y1, x2, y2):
            total += atten_per_wall
    return total


def _lines_intersect(ax, ay, bx, by, cx, cy, dx, dy) -> bool:
    d1x, d1y = bx - ax, by - ay
    d2x, d2y = dx - cx, dy - cy
    cross = d1x * d2y - d1y * d2x
    if abs(cross) < 1e-10:
        return False
    t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross
    u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross
    return 0 < t < 1 and 0 < u < 1


def compute_heatmap_grid(ap_data: list, layer: str = 'rssi') -> dict:
    canvas_w = 680
    canvas_h = 400
    step     = 8
    positions = getattr(config, 'AP_POSITIONS', {})
    enriched_aps = []
    for ap in ap_data:
        bssid = ap.get('bssid', '')
        pos   = positions.get(bssid)
        if pos:
            enriched_aps.append({
                **ap,
                'x_m': pos['x_m'],
                'y_m': pos['y_m'],
                'label': pos.get('label', ap.get('ssid', bssid)),
            })
    if not enriched_aps:
        n = len(ap_data)
        for i, ap in enumerate(ap_data):
            enriched_aps.append({
                **ap,
                'x_m': (i + 1) * config.FLOOR_WIDTH_M / (n + 1),
                'y_m': config.FLOOR_HEIGHT_M / 2,
                'label': ap.get('ssid', 'AP'),
            })

    rows = canvas_h // step
    cols = canvas_w // step

    calibration = _load_path_loss_calibration()
    calibration_points = _load_calibration_points()

    # Hybrid correction: blend the theoretical model with real measured
    # points via IDW residual correction (Part C of the RF accuracy guide).
    # Only meaningful for the continuous RSSI-derived layers.
    residual_grid = None
    confidence_grid = None
    calibration_sample_count = 0
    if calibration_points is not None and layer in ('rssi', 'coverage', 'snr'):
        calibration_sample_count = len(calibration_points)
        sample_points = calibration_points[['x', 'y']].to_numpy(dtype=float)
        theoretical_at_samples = np.array([
            _theoretical_best_rssi(float(row.x), float(row.y), enriched_aps, calibration)
            for row in calibration_points.itertuples()
        ])
        residuals = calibration_points['rssi_dbm'].to_numpy(dtype=float) - theoretical_at_samples

        grid_points = np.array([
            pixels_to_metres(col * step + step // 2, row * step + step // 2)
            for row in range(rows) for col in range(cols)
        ])

        residual_flat = idw_interpolate(grid_points, sample_points, residuals)
        confidence_flat = compute_coverage_mask(
            grid_points, sample_points, getattr(config, 'COVERAGE_MASK_MAX_DISTANCE_M', 4.0),
        )
        residual_grid = residual_flat.reshape(rows, cols)
        confidence_grid = confidence_flat.reshape(rows, cols)

    grid = []
    confidence_mask_rows = [] if confidence_grid is not None else None
    dead_zones = 0
    covered    = 0
    total      = 0

    for row in range(rows):
        grid_row = []
        confidence_row = [] if confidence_grid is not None else None
        for col in range(cols):
            px = col * step + step // 2
            py = row * step + step // 2
            x_m, y_m = pixels_to_metres(px, py)
            residual = float(residual_grid[row][col]) if residual_grid is not None else 0.0

            if layer == 'rssi' or layer == 'coverage':
                val = round(_theoretical_best_rssi(x_m, y_m, enriched_aps, calibration) + residual, 1)
            elif layer == 'snr':
                noise_floor = -95.0
                val = round(_theoretical_best_rssi(x_m, y_m, enriched_aps, calibration) + residual - noise_floor, 1)
            elif layer == 'overlap':
                visible_channels = []
                for ap in enriched_aps:
                    cal = calibration.get(ap.get('bssid', ''), {})
                    n = cal.get('n', config.PATH_LOSS_EXPONENT)
                    rssi_1m = cal.get('rssi_at_1m', config.RSSI_AT_1M)
                    r = rssi_at_point(ap['x_m'], ap['y_m'], rssi_1m, x_m, y_m, n) - wall_attenuation(ap['x_m'], ap['y_m'], x_m, y_m)
                    if r > -80: visible_channels.append(ap.get('channel', 0))
                conflicts = 0
                for i, ch1 in enumerate(visible_channels):
                    for ch2 in visible_channels[i+1:]:
                        if ch1 != ch2 and abs(ch1 - ch2) < 5: conflicts += 1
                val = float(conflicts)
            grid_row.append(val)
            if confidence_row is not None:
                confidence_row.append(bool(confidence_grid[row][col]))
            total += 1
            if val < -85: dead_zones += 1
            if val >= -70: covered += 1
        grid.append(grid_row)
        if confidence_mask_rows is not None:
            confidence_mask_rows.append(confidence_row)

    coverage_pct = round((covered / total * 100), 1) if total > 0 else 0.0
    ap_pixels = []
    for ap in enriched_aps:
        px, py = metres_to_pixels(ap['x_m'], ap['y_m'])
        ap_pixels.append({
            "id": ap.get('bssid', ''), "label": ap.get('label', ''), "ssid": ap.get('ssid', ''),
            "px": px, "py": py, "rssi": round(ap.get('rssi', -70), 1),
            "channel": ap.get('channel', 0), "band": ap.get('band', ''),
            "score": ap.get('score', 0), "status": ap.get('status', ''),
            "is_connected": ap.get('is_connected', False),
        })
    walls_px = []
    for wall in getattr(config, 'INTERNAL_WALLS', []):
        x1_m, y1_m, x2_m, y2_m = wall
        x1p, y1p = metres_to_pixels(x1_m, y1_m)
        x2p, y2p = metres_to_pixels(x2_m, y2_m)
        walls_px.append([x1p, y1p, x2p, y2p])

    result = {
        "grid": grid, "step": step, "canvas_w": canvas_w, "canvas_h": canvas_h,
        "layer": layer, "min_val": min(min(r) for r in grid), "max_val": max(max(r) for r in grid),
        "ap_pixels": ap_pixels, "walls_px": walls_px, "dead_zones": dead_zones,
        "coverage_pct": coverage_pct, "total_aps": len(enriched_aps),
    }

    if confidence_mask_rows is not None:
        # True = trust this cell (near a real measurement), False = pure
        # theory / low-confidence — front-end can grey these out.
        result["confidence_mask"] = confidence_mask_rows
        result["calibration_samples"] = calibration_sample_count

    return result
