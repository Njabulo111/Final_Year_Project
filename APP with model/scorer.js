// Scoring Service - Calculates WiFi quality scores
class Scorer {
  constructor(config) {
    this.config = config || {
      weights: {
        signal: 0.35,
        latency: 0.30,
        loss: 0.20,
        stability: 0.15,
      },
      thresholds: {
        excellentScore: 75,
        goodScore: 60,
        fairScore: 50,
      },
      normalization: {
        signalMin: -100,
        signalMax: -30,
        latencyMin: 0,
        latencyMax: 100,
        lossMax: 10,
        stabilityWindow: 10,
      },
    };
  }

  // Normalize signal strength from dBm to 0-100 score
  normalizeSignal(signalDbm) {
    const { signalMin, signalMax } = this.config.normalization;
    let score = ((signalDbm - signalMin) / (signalMax - signalMin)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  // Normalize latency (lower is better)
  normalizeLatency(latencyMs) {
    const { latencyMin, latencyMax } = this.config.normalization;
    let score = ((latencyMax - latencyMs) / (latencyMax - latencyMin)) * 100;
    return Math.max(0, Math.min(100, score));
  }

  // Normalize packet loss (lower is better)
  normalizeLoss(packetLossPercent) {
    const { lossMax } = this.config.normalization;
    let score = ((lossMax - packetLossPercent) / lossMax) * 100;
    return Math.max(0, Math.min(100, score));
  }

  // Normalize stability (arbitrary value, default 95%)
  normalizeStability(stabilityPercent) {
    return Math.max(0, Math.min(100, stabilityPercent));
  }

  // Calculate overall score
  calculateScore(signal, latency, packetLoss, stability = 95) {
    const signalScore = this.normalizeSignal(signal);
    const latencyScore = this.normalizeLatency(latency);
    const lossScore = this.normalizeLoss(packetLoss);
    const stabilityScore = this.normalizeStability(stability);

    const overallScore =
      signalScore * this.config.weights.signal +
      latencyScore * this.config.weights.latency +
      lossScore * this.config.weights.loss +
      stabilityScore * this.config.weights.stability;

    return {
      overall: Math.round(overallScore),
      subScores: {
        signal: Math.round(signalScore),
        latency: Math.round(latencyScore),
        loss: Math.round(lossScore),
        stability: Math.round(stabilityScore),
      },
    };
  }

  // Classify score into status
  getStatus(score) {
    const { excellentScore, goodScore, fairScore } = this.config.thresholds;
    if (score >= excellentScore) return 'excellent';
    if (score >= goodScore) return 'good';
    if (score >= fairScore) return 'fair';
    return 'poor';
  }

  // Get color for status
  getStatusColor(status) {
    switch (status) {
      case 'excellent':
        return '#10b981'; // Green
      case 'good':
        return '#3b82f6'; // Blue
      case 'fair':
        return '#f59e0b'; // Orange
      case 'poor':
        return '#ef4444'; // Red
      default:
        return '#6b7280'; // Gray
    }
  }
}

export default Scorer;
