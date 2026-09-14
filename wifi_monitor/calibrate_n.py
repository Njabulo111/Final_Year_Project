"""
One-time calibration script — NOT run automatically by the app.

Fits a real path-loss exponent (n) per AP from measured points instead of
using the textbook default (config.PATH_LOSS_EXPONENT = 2.7 for "indoor lab").

How to use:
  1. Walk the lab with a laptop/phone. At each stop, record:
     x, y (metres from a fixed origin corner), rssi_dbm, distance_m (measured
     or estimated from a floor plan), and which AP (ap_bssid) you measured.
     Save these rows into calibration_points.csv (see the header below).
     Minimum: 10-15 points per AP, spread across the room, including a few
     close to the AP and a few far/obstructed.
  2. Run: python calibrate_n.py
  3. It writes path_loss_calibration.json — heatmap_engine.py picks this up
     automatically on the next request (falls back to config.py defaults for
     any AP not present in the file).

Rerun this whenever you collect more calibration data.
"""

import json
import sys

import numpy as np
import pandas as pd

import config

D0 = 1.0  # reference distance, 1 metre


def fit_path_loss_exponent(distances: np.ndarray, rssi_values: np.ndarray, rssi_at_d0: float) -> float:
    """No-intercept least squares fit of n in RSSI(d) = RSSI(d0) - 10*n*log10(d/d0)."""
    X = 10 * np.log10(distances / D0)
    y = rssi_at_d0 - rssi_values
    denom = float(np.sum(X * X))
    if denom == 0:
        return config.PATH_LOSS_EXPONENT
    return float(np.sum(X * y) / denom)


def main():
    try:
        df = pd.read_csv(config.CALIBRATION_POINTS_FILE)
    except FileNotFoundError:
        print(f"No calibration file found at {config.CALIBRATION_POINTS_FILE}.")
        print("Create it first — see the header comment in this script for the format.")
        sys.exit(1)

    if df.empty:
        print("Calibration file is empty — walk the lab and log some points first.")
        sys.exit(1)

    results = {}
    for bssid, group in df.groupby('ap_bssid'):
        if len(group) < 3:
            print(f"Skipping {bssid}: only {len(group)} sample(s), need at least 3.")
            continue

        closest_idx = (group['distance_m'] - D0).abs().idxmin()
        rssi_at_d0 = float(group.loc[closest_idx, 'rssi_dbm'])

        n_fitted = fit_path_loss_exponent(
            group['distance_m'].to_numpy(dtype=float),
            group['rssi_dbm'].to_numpy(dtype=float),
            rssi_at_d0,
        )

        results[bssid] = {
            'n': round(n_fitted, 3),
            'rssi_at_1m': round(rssi_at_d0, 1),
            'sample_count': int(len(group)),
        }
        print(f"{bssid}: n = {n_fitted:.2f} (from {len(group)} points, RSSI@1m ≈ {rssi_at_d0:.1f} dBm)")

    if not results:
        print("No AP had enough samples to calibrate. Nothing written.")
        sys.exit(1)

    with open(config.PATH_LOSS_CALIBRATION_FILE, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nWrote calibration for {len(results)} AP(s) to {config.PATH_LOSS_CALIBRATION_FILE}")


if __name__ == '__main__':
    main()
