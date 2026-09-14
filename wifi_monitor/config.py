# config.py
# ─────────────────────────────────────────────────────────────────
# All system settings live here. Change values here only.
# ─────────────────────────────────────────────────────────────────

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

# Environment-driven production settings
APP_ENV = os.getenv('APP_ENV', 'development').lower()
FLASK_HOST = os.getenv('FLASK_HOST', '0.0.0.0')
FLASK_PORT = int(os.getenv('FLASK_PORT', '5000'))
FLASK_DEBUG = os.getenv('FLASK_DEBUG', 'false').lower() in {'1', 'true', 'yes', 'on'}
DATABASE_FILE = os.getenv('DATABASE_FILE', str(BASE_DIR / 'wifi_log.db'))

# How often the system scans (seconds)
SCAN_INTERVAL_SECONDS = int(os.getenv('SCAN_INTERVAL_SECONDS', '10'))

# Ping test settings
PING_TARGET = os.getenv('PING_TARGET', '8.8.8.8')
PING_COUNT = int(os.getenv('PING_COUNT', '10'))
PING_TIMEOUT_SECONDS = int(os.getenv('PING_TIMEOUT_SECONDS', '2'))

# Scoring formula weights (must add up to 1.0)
WEIGHT_SIGNAL = float(os.getenv('WEIGHT_SIGNAL', '0.35'))
WEIGHT_LATENCY = float(os.getenv('WEIGHT_LATENCY', '0.30'))
WEIGHT_LOSS = float(os.getenv('WEIGHT_LOSS', '0.20'))
WEIGHT_STABILITY = float(os.getenv('WEIGHT_STABILITY', '0.15'))

# Score thresholds for classification
THRESHOLD_GOOD = float(os.getenv('THRESHOLD_GOOD', '75'))
THRESHOLD_MODERATE = float(os.getenv('THRESHOLD_MODERATE', '50'))

# Recommendation threshold
RECOMMEND_MARGIN = float(os.getenv('RECOMMEND_MARGIN', '15'))

# RSSI normalisation bounds (dBm)
RSSI_BEST = float(os.getenv('RSSI_BEST', '-30'))
RSSI_WORST = float(os.getenv('RSSI_WORST', '-90'))

# Latency normalisation bounds (ms)
LATENCY_BEST = float(os.getenv('LATENCY_BEST', '10'))
LATENCY_WORST = float(os.getenv('LATENCY_WORST', '200'))

# Packet loss normalisation bounds (%)
LOSS_BEST = float(os.getenv('LOSS_BEST', '0'))
LOSS_WORST = float(os.getenv('LOSS_WORST', '20'))

# Traffic detection tuning for production monitoring
TRAFFIC_BURST_THRESHOLD_BYTES = int(os.getenv('TRAFFIC_BURST_THRESHOLD_BYTES', str(512 * 1024)))
TRAFFIC_BURST_WINDOW_SECONDS = int(os.getenv('TRAFFIC_BURST_WINDOW_SECONDS', '2'))

# Flask settings
FLASK_SECRET_KEY = os.getenv('FLASK_SECRET_KEY', 'change-this-secret-key')

# ─── Floor plan settings ───────────────────────────────────────────
# Grid resolution: how many metres each pixel represents
HEATMAP_GRID_SIZE = 0.5       # 0.5 metres per pixel

# Floor plan dimensions in metres
FLOOR_WIDTH_M  = 20.0         # width of your lab in metres
FLOOR_HEIGHT_M = 12.0         # height of your lab in metres

# Path loss model (same as locator.py)
RSSI_AT_1M         = -40      # calibrate by standing 1m from an AP
PATH_LOSS_EXPONENT = 2.7      # 2.7 for indoor lab — textbook default, used
                               # for any AP not present in PATH_LOSS_CALIBRATION_FILE

# ─── RF calibration (see calibrate_n.py) ──────────────────────────────
# calibration_points.csv: real measured points (x, y, rssi_dbm, distance_m,
# ap_bssid) collected by walking the lab. Run calibrate_n.py to fit a real
# per-AP path-loss exponent from it into PATH_LOSS_CALIBRATION_FILE, and
# heatmap_engine.py blends the theoretical model with these real points via
# IDW residual correction.
CALIBRATION_POINTS_FILE = str(BASE_DIR / 'calibration_points.csv')
PATH_LOSS_CALIBRATION_FILE = str(BASE_DIR / 'path_loss_calibration.json')
MIN_CALIBRATION_SAMPLES = 5          # below this, skip residual correction entirely
COVERAGE_MASK_MAX_DISTANCE_M = 4.0   # grid cells farther than this from any
                                      # real measurement are flagged low-confidence

# Wall attenuation — signal loss through each wall type (dBm)
WALL_ATTENUATION = {
    "concrete": 12,
    "brick":     8,
    "drywall":   4,
    "glass":     2,
    "none":      0,
}

# Default wall type in your lab
DEFAULT_WALL_TYPE = "drywall"

# ─── AP positions on the floor plan (in metres from top-left corner) ─
AP_POSITIONS = {
    "AA:11:22:33:44:01": {
        "label": "AP-Lab-North",
        "wall":  "north",
        "x_m":   3.0,
        "y_m":   1.0,
    },
    "AA:11:22:33:44:02": {
        "label": "AP-Lab-East",
        "wall":  "east",
        "x_m":   18.0,
        "y_m":   2.5,
    },
    "AA:11:22:33:44:03": {
        "label": "AP-Lab-South",
        "wall":  "south",
        "x_m":   15.0,
        "y_m":   11.0,
    },
    "AA:11:22:33:44:04": {
        "label": "AP-Lab-West",
        "wall":  "west",
        "x_m":   2.0,
        "y_m":   9.0,
    },
}

# ─── Wall definitions (line segments on the floor plan, in metres) ──
INTERNAL_WALLS = [
    [10.0, 0.0, 10.0, 6.0],
    [10.0, 6.0, 20.0, 6.0],
    [5.0,  6.0, 5.0, 12.0],
]

# ─── Switching settings ─────────────────────────────────────────────
# Only show Switch button if target AP score is this much higher
SWITCH_SCORE_MARGIN = 15   # points above current AP score
