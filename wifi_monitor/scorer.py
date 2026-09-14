# scorer.py
from dataclasses import dataclass
from typing import List, Optional
import config
from scanner import AccessPoint
from adaptive_learning import get_dynamic_weights


@dataclass
class ScoredAP:
    ap:            AccessPoint
    signal_norm:   float = 0.0
    latency_norm:  float = 0.0
    loss_norm:     float = 0.0
    stability_norm: float= 0.0
    score:         float = 0.0
    status:        str   = ''
    status_colour: str   = ''
    latency_ms:    float = 0.0
    loss_pct:      float = 0.0


def normalise(value: float, best: float, worst: float) -> float:
    if best == worst: return 100.0
    raw = (value - worst) / (best - worst) * 100.0
    return max(0.0, min(100.0, raw))


def classify(score: float) -> tuple:
    if score >= config.THRESHOLD_GOOD: return ('GOOD', 'green')
    elif score >= config.THRESHOLD_MODERATE: return ('MODERATE', 'orange')
    else: return ('CONGESTED', 'red')


def get_weights() -> dict:
    return get_dynamic_weights()


def score_ap(ap: AccessPoint, latency_ms: float = 0.0, loss_pct: float = 0.0, stability: float = 80.0) -> ScoredAP:
    weights = get_weights()
    sig_norm = normalise(ap.rssi, config.RSSI_BEST, config.RSSI_WORST)
    lat_norm = normalise(latency_ms, config.LATENCY_BEST, config.LATENCY_WORST)
    loss_norm = normalise(loss_pct, config.LOSS_BEST, config.LOSS_WORST)

    score = (
        weights['signal'] * sig_norm +
        weights['latency'] * lat_norm +
        weights['loss'] * loss_norm +
        weights['stability'] * stability
    )
    score = round(score, 1)
    status, colour = classify(score)

    return ScoredAP(
        ap=ap, signal_norm=round(sig_norm, 1), latency_norm=round(lat_norm, 1),
        loss_norm=round(loss_norm, 1), stability_norm=round(stability, 1),
        score=score, status=status, status_colour=colour,
        latency_ms=latency_ms, loss_pct=loss_pct
    )


def score_all_aps(aps: List[AccessPoint], latency_ms: float, loss_pct: float, stability: float = 80.0) -> List[ScoredAP]:
    scored = []
    for ap in aps:
        if ap.is_connected:
            scored.append(score_ap(ap, latency_ms, loss_pct, stability))
        else:
            scored.append(score_ap(ap, 0.0, 0.0, 85.0))
    return scored


def make_recommendation(scored_aps: List[ScoredAP]) -> Optional[str]:
    current = next((s for s in scored_aps if s.ap.is_connected), None)
    if current is None: return None
    others = [s for s in scored_aps if not s.ap.is_connected]
    if not others: return None
    best_other = max(others, key=lambda s: s.score)
    improvement = best_other.score - current.score
    if improvement >= config.RECOMMEND_MARGIN:
        return f'Better AP available: {best_other.ap.ssid} (Score {best_other.score:.0f} vs current {current.score:.0f}).'
    elif current.status == 'CONGESTED':
        return 'Your current AP is congested. Try moving closer or waiting for less traffic.'
    return None
