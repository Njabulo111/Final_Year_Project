"""
Hybrid RF estimation: corrects the theoretical Log-Distance model using
residuals from real measured points (calibration_points.csv), via Inverse
Distance Weighting (IDW). Pure numpy — no scipy/sklearn dependency, since
neither is installed in this project's environment.
"""

import numpy as np


def idw_interpolate(grid_points: np.ndarray, sample_points: np.ndarray, sample_values: np.ndarray, power: float = 2) -> np.ndarray:
    """
    grid_points: (N, 2) array of x,y to estimate
    sample_points: (M, 2) array of measured x,y
    sample_values: (M,) array of residuals (or values) at those points

    Returns an (N,) array of interpolated values at each grid point.
    """
    if len(sample_points) == 0:
        return np.zeros(len(grid_points))

    # (N, M) pairwise distance matrix without scipy's cdist
    diff = grid_points[:, None, :] - sample_points[None, :, :]
    dist = np.sqrt(np.sum(diff ** 2, axis=2))
    dist = np.where(dist == 0, 1e-6, dist)  # avoid divide-by-zero at exact sample locations

    weights = 1 / (dist ** power)
    weights /= weights.sum(axis=1, keepdims=True)
    return weights @ sample_values


def coverage_mask(grid_points: np.ndarray, sample_points: np.ndarray, max_distance: float = 4.0) -> np.ndarray:
    """
    Returns an (N,) boolean array: True where the grid point is within
    max_distance of some real calibration measurement (trustworthy),
    False where it's extrapolated purely from theory (should be greyed
    out / flagged as low-confidence in the UI).
    """
    if len(sample_points) == 0:
        return np.zeros(len(grid_points), dtype=bool)

    diff = grid_points[:, None, :] - sample_points[None, :, :]
    dist = np.sqrt(np.sum(diff ** 2, axis=2))
    min_dist = dist.min(axis=1)
    return min_dist <= max_distance
