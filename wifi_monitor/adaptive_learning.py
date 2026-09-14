import config
import database


def get_dynamic_weights() -> dict:
    weights = database.get_adaptive_weights()
    return {
        'signal': float(weights['signal']),
        'latency': float(weights['latency']),
        'loss': float(weights['loss']),
        'stability': float(weights['stability']),
    }


def update_weights_from_outcome(outcome: dict) -> dict:
    weights = get_dynamic_weights()
    if not outcome:
        return weights

    metric = outcome.get('metric', 'latency')
    improved = bool(outcome.get('improved', False))
    delta = 0.01

    if metric == 'latency':
        weights['latency'] = max(0.05, min(0.45, weights['latency'] + (delta if improved else -delta)))
    elif metric == 'loss':
        weights['loss'] = max(0.05, min(0.45, weights['loss'] + (delta if improved else -delta)))
    elif metric == 'signal':
        weights['signal'] = max(0.05, min(0.45, weights['signal'] + (delta if improved else -delta)))
    else:
        weights['stability'] = max(0.05, min(0.45, weights['stability'] + (delta if improved else -delta)))

    total = sum(weights.values())
    for key in weights:
        weights[key] = weights[key] / total

    database.save_adaptive_weights(weights)
    return weights
