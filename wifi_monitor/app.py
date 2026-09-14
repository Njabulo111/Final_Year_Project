# app.py
import datetime
import threading
import time
from flask import Flask, render_template, jsonify, request
import config
import database
from scanner import scan_all_aps
from tester  import measure_connection
from scorer  import score_all_aps, make_recommendation
from switcher import switch_to_ap
from locator import build_location_message
from heatmap_engine import compute_heatmap_grid

app = Flask(__name__)
app.config['SECRET_KEY'] = config.FLASK_SECRET_KEY
latest_data = {
    'aps': [],
    'recommendation': '',
    'timestamp': '',
    'scan_count': 0,
    'nav_message': '',
    'nav_target_bssid': '',
    'adaptive_weights': {
        'signal': config.WEIGHT_SIGNAL,
        'latency': config.WEIGHT_LATENCY,
        'loss': config.WEIGHT_LOSS,
        'stability': config.WEIGHT_STABILITY,
    }
}
latest_lock = threading.Lock()
_rssi_history = []
_target_rssi_history = {}
_scan_loop_thread = None
_scan_loop_started = False


def start_scan_loop():
    global _scan_loop_thread, _scan_loop_started
    if _scan_loop_started:
        return

    database.init_database()
    _scan_loop_thread = threading.Thread(target=scan_loop, daemon=True, name='wifi-scan-loop')
    _scan_loop_thread.start()
    _scan_loop_started = True
    print('[App] scan loop started')

def compute_stability(current_rssi: int) -> float:
    _rssi_history.append(current_rssi)
    if len(_rssi_history) > 5: _rssi_history.pop(0)
    if len(_rssi_history) < 2: return 80.0
    spread = max(_rssi_history) - min(_rssi_history)
    return max(0.0, 100.0 - spread * 3)

def scan_loop():
    global latest_data
    scan_count = 0
    database.init_database()
    while True:
        try:
            scan_count += 1
            aps = scan_all_aps()
            if not aps:
                time.sleep(config.SCAN_INTERVAL_SECONDS)
                continue
            connected = next((a for a in aps if a.is_connected), None)
            stability = compute_stability(connected.rssi if connected else -70)
            if connected:
                latency_ms, loss_pct = measure_connection()
                scored = score_all_aps(aps, latency_ms, loss_pct, stability)
                recommendation = make_recommendation(scored) or 'Current AP is performing well.'
            else:
                scored = score_all_aps(aps, 0.0, 0.0, stability)
                recommendation = 'Device is not connected to a WiFi network. Select an AP and use the switch button to connect.'
            scored.sort(key=lambda s: s.score, reverse=True)
            database.save_scan_results(scored, recommendation)

            for s in scored:
                _target_rssi_history[s.ap.bssid] = s.ap.rssi

            nav_message = ""
            current_nav_target = ""
            with latest_lock:
                current_nav_target = latest_data.get("nav_target_bssid", "")

            if current_nav_target:
                nav_ap = next((s for s in scored if s.ap.bssid == current_nav_target), None)
                if nav_ap:
                    prev_rssi = _target_rssi_history.get(current_nav_target + "_prev")
                    nav_message = build_location_message(
                        target_bssid  = current_nav_target,
                        current_rssi  = nav_ap.ap.rssi,
                        previous_rssi = prev_rssi,
                        target_ssid   = nav_ap.ap.ssid
                    )
                    _target_rssi_history[current_nav_target + "_prev"] = nav_ap.ap.rssi

            with latest_lock:
                latest_data = {
                    'aps': [{
                        'ssid': s.ap.ssid, 'bssid': s.ap.bssid, 'rssi': s.ap.rssi,
                        'channel': s.ap.channel, 'band': s.ap.band, 'is_connected': s.ap.is_connected,
                        'latency_ms': s.latency_ms if s.ap.is_connected else None,
                        'loss_pct': s.loss_pct if s.ap.is_connected else None,
                        'score': s.score, 'status': s.status, 'colour': s.status_colour
                    } for s in scored],
                    'recommendation': recommendation,
                    'timestamp': datetime.datetime.now(datetime.timezone.utc).strftime('%H:%M:%S'),
                    'scan_count': scan_count,
                    'nav_message': nav_message,
                    'nav_target_bssid': current_nav_target,
                    'connected_ssid': connected.ssid if connected else None,
                    'connected_bssid': connected.bssid if connected else None
                }
        except Exception as e:
            print(f'[App] scan loop error (cycle {scan_count}): {e}')
        time.sleep(config.SCAN_INTERVAL_SECONDS)

@app.route('/')
def index(): return render_template('dashboard.html')

@app.route('/survey')
def survey(): return render_template('survey.html')

@app.route('/api/health')
def api_health():
    return jsonify({
        'status': 'ok',
        'app_env': config.APP_ENV,
        'backend': 'wifi-monitor',
        'database': config.DATABASE_FILE,
        'scan_interval_seconds': config.SCAN_INTERVAL_SECONDS,
    })

@app.route('/api/data')
def api_data():
    with latest_lock: return jsonify(latest_data)

@app.route('/api/heatmap')
def api_heatmap():
    layer = request.args.get('layer', 'rssi')
    with latest_lock: ap_list = latest_data.get('aps', [])
    if not ap_list:
        # Expected transient state right after startup, not a server error —
        # 200 with a status the frontend can handle gracefully, not a 503.
        return jsonify({
            "status": "no_scan_data",
            "message": "No scan data yet — the scanner hasn't completed a first pass. Try again in a few seconds.",
        }), 200
    payload = compute_heatmap_grid(ap_list, layer)
    payload["status"] = "ok"
    return jsonify(payload)

@app.route('/api/weights', methods=['GET', 'POST'])
def api_weights():
    if request.method == 'GET':
        return jsonify(database.get_adaptive_weights())
    data = request.get_json() or {}
    weights = {
        'signal': float(data.get('signal', config.WEIGHT_SIGNAL)),
        'latency': float(data.get('latency', config.WEIGHT_LATENCY)),
        'loss': float(data.get('loss', config.WEIGHT_LOSS)),
        'stability': float(data.get('stability', config.WEIGHT_STABILITY)),
    }
    total = sum(weights.values())
    if total <= 0:
        return jsonify({"success": False, "message": "Weights must sum to a positive value."}), 400
    for key, value in weights.items():
        weights[key] = value / total
    database.save_adaptive_weights(weights)
    with latest_lock:
        latest_data['adaptive_weights'] = weights
    return jsonify({"success": True, "weights": weights})

@app.route('/api/known-networks')
def api_known_networks():
    return jsonify(database.get_known_networks(50))

@app.route('/api/switch', methods=['POST'])
def api_switch():
    data = request.get_json()
    if not data or 'ssid' not in data: return jsonify({"success": False, "message": "Missing SSID"}), 400
    target_ssid, target_bssid = data['ssid'], data.get('bssid')
    result = switch_to_ap(target_ssid, target_bssid)
    database.log_switch_event(target_ssid, target_bssid or '', result['success'], result['message'])
    return jsonify(result)

@app.route('/api/navigate', methods=['POST'])
def api_navigate():
    data = request.get_json()
    target_bssid = data.get('bssid', '')
    with latest_lock: latest_data['nav_target_bssid'] = target_bssid
    return jsonify({"status": "navigating" if target_bssid else "cancelled"})

@app.route('/api/history')
def api_history(): return jsonify(database.get_recent_logs(100))

@app.route('/api/export')
def api_export():
    database.export_to_csv()
    return jsonify({'status': 'exported'})

start_scan_loop()

if __name__ == '__main__':
    app.run(host=config.FLASK_HOST, port=config.FLASK_PORT, debug=config.FLASK_DEBUG, use_reloader=False)
