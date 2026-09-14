# database.py
import sqlite3
import csv
import datetime
import config
from scorer import ScoredAP
from typing import List

CREATE_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS wifi_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp     TEXT    NOT NULL,
    ssid          TEXT,
    bssid         TEXT,
    rssi          INTEGER,
    channel       INTEGER,
    band          TEXT,
    is_connected  INTEGER,
    latency_ms    REAL,
    loss_pct      REAL,
    score         REAL,
    status        TEXT,
    recommendation TEXT
);
'''

CREATE_WEIGHTS_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS adaptive_weights (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    signal_weight REAL NOT NULL,
    latency_weight REAL NOT NULL,
    loss_weight REAL NOT NULL,
    stability_weight REAL NOT NULL,
    updated_at TEXT NOT NULL
);
'''

CREATE_KNOWN_NETWORKS_SQL = '''
CREATE TABLE IF NOT EXISTS known_networks (
    bssid TEXT PRIMARY KEY,
    ssid TEXT NOT NULL,
    last_rssi INTEGER,
    last_score REAL,
    average_score REAL,
    last_seen TEXT NOT NULL,
    total_visits INTEGER DEFAULT 0
);
'''

CREATE_SWITCH_EVENTS_SQL = '''
CREATE TABLE IF NOT EXISTS switch_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    target_ssid TEXT,
    target_bssid TEXT,
    success INTEGER NOT NULL,
    message TEXT
);
'''

DEFAULT_WEIGHTS = (
    config.WEIGHT_SIGNAL,
    config.WEIGHT_LATENCY,
    config.WEIGHT_LOSS,
    config.WEIGHT_STABILITY,
    datetime.datetime.now().isoformat(),
)


def init_database():
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.execute(CREATE_TABLE_SQL)
    conn.execute(CREATE_WEIGHTS_TABLE_SQL)
    conn.execute(CREATE_KNOWN_NETWORKS_SQL)
    conn.execute(CREATE_SWITCH_EVENTS_SQL)
    conn.execute(
        'INSERT OR IGNORE INTO adaptive_weights (id, signal_weight, latency_weight, loss_weight, stability_weight, updated_at) VALUES (1, ?, ?, ?, ?, ?)',
        DEFAULT_WEIGHTS,
    )
    conn.commit()
    conn.close()


def get_adaptive_weights() -> dict:
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    row = conn.execute('SELECT signal_weight, latency_weight, loss_weight, stability_weight FROM adaptive_weights WHERE id = 1').fetchone()
    conn.close()
    if not row:
        return {
            'signal': config.WEIGHT_SIGNAL,
            'latency': config.WEIGHT_LATENCY,
            'loss': config.WEIGHT_LOSS,
            'stability': config.WEIGHT_STABILITY,
        }
    return {
        'signal': float(row['signal_weight']),
        'latency': float(row['latency_weight']),
        'loss': float(row['loss_weight']),
        'stability': float(row['stability_weight']),
    }


def save_adaptive_weights(weights: dict):
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.execute(
        'UPDATE adaptive_weights SET signal_weight=?, latency_weight=?, loss_weight=?, stability_weight=?, updated_at=? WHERE id=1',
        (
            float(weights['signal']),
            float(weights['latency']),
            float(weights['loss']),
            float(weights['stability']),
            datetime.datetime.now().isoformat(),
        ),
    )
    conn.commit()
    conn.close()


def upsert_known_network(ap: ScoredAP, conn: sqlite3.Connection = None):
    owns_conn = conn is None
    if owns_conn:
        conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.execute(
        '''
        INSERT INTO known_networks (bssid, ssid, last_rssi, last_score, average_score, last_seen, total_visits)
        VALUES (?, ?, ?, ?, ?, ?, 1)
        ON CONFLICT(bssid)
        DO UPDATE SET
            ssid=excluded.ssid,
            last_rssi=excluded.last_rssi,
            last_score=excluded.last_score,
            average_score=((known_networks.average_score * known_networks.total_visits) + excluded.last_score) / (known_networks.total_visits + 1),
            last_seen=excluded.last_seen,
            total_visits=known_networks.total_visits + 1
        ''',
        (ap.ap.bssid, ap.ap.ssid, ap.ap.rssi, ap.score, ap.score, datetime.datetime.now().isoformat()),
    )
    if owns_conn:
        conn.commit()
        conn.close()


def get_known_networks(limit: int = 50):
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    rows = conn.execute('SELECT * FROM known_networks ORDER BY last_seen DESC LIMIT ?', (limit,)).fetchall()
    conn.close()
    return [dict(row) for row in rows]


def log_switch_event(target_ssid: str, target_bssid: str, success: bool, message: str):
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.execute(
        'INSERT INTO switch_events (timestamp, target_ssid, target_bssid, success, message) VALUES (?, ?, ?, ?, ?)',
        (datetime.datetime.now().isoformat(), target_ssid, target_bssid, 1 if success else 0, message),
    )
    conn.commit()
    conn.close()


def save_scan_results(scored_aps: List[ScoredAP], recommendation: str = ''):
    timestamp = datetime.datetime.now().isoformat()
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    cursor = conn.cursor()
    for s in scored_aps:
        cursor.execute(
            'INSERT INTO wifi_log VALUES (NULL,?,?,?,?,?,?,?,?,?,?,?,?)',
            (timestamp, s.ap.ssid, s.ap.bssid, s.ap.rssi, s.ap.channel, s.ap.band,
             1 if s.ap.is_connected else 0, s.latency_ms if s.ap.is_connected else None,
             s.loss_pct if s.ap.is_connected else None, s.score, s.status,
             recommendation if s.ap.is_connected else None)
        )
        upsert_known_network(s, conn=conn)
    conn.commit()
    conn.close()


def get_recent_logs(limit: int = 200):
    conn = sqlite3.connect(config.DATABASE_FILE, timeout=10)
    conn.row_factory = sqlite3.Row
    cursor = conn.execute('SELECT * FROM wifi_log ORDER BY id DESC LIMIT ?', (limit,))
    rows = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return rows


def export_to_csv(filename: str = 'wifi_export.csv'):
    rows = get_recent_logs(10000)
    if not rows: return
    with open(filename, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
