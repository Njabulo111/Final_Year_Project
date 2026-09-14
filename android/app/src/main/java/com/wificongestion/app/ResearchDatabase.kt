package com.wificongestion.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class ScanHistoryRow(
    val scanId: Long,
    val timestamp: String,
    val ssid: String,
    val bssid: String,
    val rssiDbm: Int,
    val latencyMs: Double,
    val packetLossPct: Double,
    val signalScore: Int,
    val latencyScore: Int,
    val packetlossScore: Int,
    val stabilityScore: Int,
    val totalScore: Int,
    val status: String,
    val connected: Boolean,
    val snrProxyScore: Int = 0,
    val switchTriggered: Boolean = false,
    val switchAccepted: Boolean? = null,
    val cycleState: String = "MONITORING",
)

data class SwitchEventRow(
    val eventId: Long,
    val timestamp: String,
    val fromSsid: String,
    val fromBssid: String,
    val toSsid: String,
    val toBssid: String,
    val fromTotalScore: Int,
    val toTotalScore: Int,
    val fromStabilityScore: Int,
    val toStabilityScore: Int,
    val accepted: Boolean,
    val connectSucceeded: Boolean?,
)

data class KnownNetworkRow(
    val bssid: String,
    val ssid: String,
    val lastIp: String?,
    val lastGateway: String?,
    val lastRssiDbm: Int,
    val firstSeen: String,
    val lastSeen: String,
    val averageScore: Double,
    val visitCount: Int,
)

data class WeightRow(
    val metric: String,
    val weight: Double,
    val lastUpdated: String,
    val notes: String,
)

private const val DB_NAME = "wifi_research.db"
private const val DB_VERSION = 2

private const val TABLE_SCAN_HISTORY = "scan_history"
private const val TABLE_KNOWN_NETWORKS = "known_networks"
private const val TABLE_WEIGHTS = "weights"
private const val TABLE_SWITCH_EVENTS = "switch_events"

class ResearchDatabase(context: Context) : SQLiteOpenHelper(context.applicationContext, DB_NAME, null, DB_VERSION) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE $TABLE_SCAN_HISTORY (
                scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                ssid TEXT NOT NULL,
                bssid TEXT NOT NULL,
                rssi_dbm INTEGER,
                latency_ms REAL,
                packet_loss_pct REAL,
                signal_score INTEGER,
                latency_score INTEGER,
                packetloss_score INTEGER,
                stability_score INTEGER,
                total_score INTEGER,
                status TEXT,
                connected INTEGER,
                snr_proxy_score INTEGER DEFAULT 0,
                switch_triggered INTEGER DEFAULT 0,
                switch_accepted INTEGER,
                cycle_state TEXT DEFAULT 'MONITORING'
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE $TABLE_KNOWN_NETWORKS (
                bssid TEXT PRIMARY KEY,
                ssid TEXT,
                last_ip TEXT,
                last_gateway TEXT,
                last_rssi_dbm INTEGER,
                first_seen TEXT,
                last_seen TEXT,
                average_score REAL,
                visit_count INTEGER
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE $TABLE_WEIGHTS (
                metric TEXT PRIMARY KEY,
                weight REAL,
                last_updated TEXT,
                notes TEXT
            )
            """.trimIndent()
        )

        db.execSQL(
            """
            CREATE TABLE $TABLE_SWITCH_EVENTS (
                event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                from_ssid TEXT,
                from_bssid TEXT,
                to_ssid TEXT,
                to_bssid TEXT,
                from_total_score INTEGER,
                to_total_score INTEGER,
                from_stability_score INTEGER,
                to_stability_score INTEGER,
                accepted INTEGER,
                connect_succeeded INTEGER
            )
            """.trimIndent()
        )

        seedDefaultWeights(db)
    }

    /**
     * Additive migrations only — this file is the device's local research log, and an
     * OTA app update (see the GitHub-releases updater) must never silently erase a
     * participant's accumulated scan history just because the schema grew a column.
     */
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            db.execSQL("ALTER TABLE $TABLE_SCAN_HISTORY ADD COLUMN snr_proxy_score INTEGER DEFAULT 0")
            db.execSQL("ALTER TABLE $TABLE_SCAN_HISTORY ADD COLUMN switch_triggered INTEGER DEFAULT 0")
            db.execSQL("ALTER TABLE $TABLE_SCAN_HISTORY ADD COLUMN switch_accepted INTEGER")
            db.execSQL("ALTER TABLE $TABLE_SCAN_HISTORY ADD COLUMN cycle_state TEXT DEFAULT 'MONITORING'")
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS $TABLE_SWITCH_EVENTS (
                    event_id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    from_ssid TEXT,
                    from_bssid TEXT,
                    to_ssid TEXT,
                    to_bssid TEXT,
                    from_total_score INTEGER,
                    to_total_score INTEGER,
                    from_stability_score INTEGER,
                    to_stability_score INTEGER,
                    accepted INTEGER,
                    connect_succeeded INTEGER
                )
                """.trimIndent()
            )
            val revisionNote = "v2 revision (${isoNow()}): added snr term, weights renormalized — see ScoringEngine.kt"
            db.execSQL(
                "INSERT OR IGNORE INTO $TABLE_WEIGHTS (metric, weight, last_updated, notes) VALUES ('snr', ${ScoringEngine.WEIGHT_SNR}, '${isoNow()}', '$revisionNote')"
            )
        }
    }

    private fun seedDefaultWeights(db: SQLiteDatabase) {
        val now = isoNow()
        val defaults = listOf(
            WeightRow("signal", ScoringEngine.WEIGHT_SIGNAL, now, "v2 default weight (adds SNR term) — see ScoringEngine.kt"),
            WeightRow("latency", ScoringEngine.WEIGHT_LATENCY, now, "v2 default weight (adds SNR term) — see ScoringEngine.kt"),
            WeightRow("loss", ScoringEngine.WEIGHT_LOSS, now, "v2 default weight (adds SNR term) — see ScoringEngine.kt"),
            WeightRow("stability", ScoringEngine.WEIGHT_STABILITY, now, "v2 default weight (adds SNR term) — see ScoringEngine.kt"),
            WeightRow("snr", ScoringEngine.WEIGHT_SNR, now, "v2 default weight (adds SNR term) — see ScoringEngine.kt"),
        )
        defaults.forEach { row ->
            val values = ContentValues().apply {
                put("metric", row.metric)
                put("weight", row.weight)
                put("last_updated", row.lastUpdated)
                put("notes", row.notes)
            }
            db.insertWithOnConflict(TABLE_WEIGHTS, null, values, SQLiteDatabase.CONFLICT_IGNORE)
        }
    }

    fun insertScan(row: ScanHistoryRow) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("timestamp", row.timestamp)
            put("ssid", row.ssid)
            put("bssid", row.bssid)
            put("rssi_dbm", row.rssiDbm)
            put("latency_ms", row.latencyMs)
            put("packet_loss_pct", row.packetLossPct)
            put("signal_score", row.signalScore)
            put("latency_score", row.latencyScore)
            put("packetloss_score", row.packetlossScore)
            put("stability_score", row.stabilityScore)
            put("total_score", row.totalScore)
            put("status", row.status)
            put("connected", if (row.connected) 1 else 0)
            put("snr_proxy_score", row.snrProxyScore)
            put("switch_triggered", if (row.switchTriggered) 1 else 0)
            put("switch_accepted", row.switchAccepted?.let { if (it) 1 else 0 })
            put("cycle_state", row.cycleState)
        }
        db.insert(TABLE_SCAN_HISTORY, null, values)

        upsertKnownNetwork(row)
        trimScanHistory(db, maxRows = 20000)
    }

    fun insertSwitchEvent(row: SwitchEventRow) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("timestamp", row.timestamp)
            put("from_ssid", row.fromSsid)
            put("from_bssid", row.fromBssid)
            put("to_ssid", row.toSsid)
            put("to_bssid", row.toBssid)
            put("from_total_score", row.fromTotalScore)
            put("to_total_score", row.toTotalScore)
            put("from_stability_score", row.fromStabilityScore)
            put("to_stability_score", row.toStabilityScore)
            put("accepted", if (row.accepted) 1 else 0)
            put("connect_succeeded", row.connectSucceeded?.let { if (it) 1 else 0 })
        }
        db.insert(TABLE_SWITCH_EVENTS, null, values)
    }

    fun getSwitchEvents(limit: Int = 500): List<SwitchEventRow> {
        val db = readableDatabase
        val cursor = db.query(TABLE_SWITCH_EVENTS, null, null, null, null, null, "event_id DESC", limit.toString())
        val rows = mutableListOf<SwitchEventRow>()
        cursor.use {
            while (it.moveToNext()) {
                rows.add(
                    SwitchEventRow(
                        eventId = it.getLong(it.getColumnIndexOrThrow("event_id")),
                        timestamp = it.getString(it.getColumnIndexOrThrow("timestamp")),
                        fromSsid = it.getString(it.getColumnIndexOrThrow("from_ssid")) ?: "",
                        fromBssid = it.getString(it.getColumnIndexOrThrow("from_bssid")) ?: "",
                        toSsid = it.getString(it.getColumnIndexOrThrow("to_ssid")) ?: "",
                        toBssid = it.getString(it.getColumnIndexOrThrow("to_bssid")) ?: "",
                        fromTotalScore = it.getInt(it.getColumnIndexOrThrow("from_total_score")),
                        toTotalScore = it.getInt(it.getColumnIndexOrThrow("to_total_score")),
                        fromStabilityScore = it.getInt(it.getColumnIndexOrThrow("from_stability_score")),
                        toStabilityScore = it.getInt(it.getColumnIndexOrThrow("to_stability_score")),
                        accepted = it.getInt(it.getColumnIndexOrThrow("accepted")) == 1,
                        connectSucceeded = if (it.isNull(it.getColumnIndexOrThrow("connect_succeeded"))) null
                        else it.getInt(it.getColumnIndexOrThrow("connect_succeeded")) == 1,
                    )
                )
            }
        }
        return rows
    }

    private fun trimScanHistory(db: SQLiteDatabase, maxRows: Int) {
        db.execSQL(
            """
            DELETE FROM $TABLE_SCAN_HISTORY WHERE scan_id NOT IN (
                SELECT scan_id FROM $TABLE_SCAN_HISTORY ORDER BY scan_id DESC LIMIT $maxRows
            )
            """.trimIndent()
        )
    }

    private fun upsertKnownNetwork(row: ScanHistoryRow) {
        val db = writableDatabase
        val cursor = db.query(
            TABLE_KNOWN_NETWORKS,
            arrayOf("average_score", "visit_count", "first_seen"),
            "bssid = ?",
            arrayOf(row.bssid),
            null, null, null,
        )

        val values = ContentValues().apply {
            put("bssid", row.bssid)
            put("ssid", row.ssid)
            put("last_rssi_dbm", row.rssiDbm)
            put("last_seen", row.timestamp)
        }

        if (cursor.moveToFirst()) {
            val prevAvg = cursor.getDouble(cursor.getColumnIndexOrThrow("average_score"))
            val prevCount = cursor.getInt(cursor.getColumnIndexOrThrow("visit_count"))
            val newCount = prevCount + 1
            val newAvg = (prevAvg * prevCount + row.totalScore) / newCount
            values.put("average_score", newAvg)
            values.put("visit_count", newCount)
            cursor.close()
            db.update(TABLE_KNOWN_NETWORKS, values, "bssid = ?", arrayOf(row.bssid))
        } else {
            cursor.close()
            values.put("first_seen", row.timestamp)
            values.put("average_score", row.totalScore.toDouble())
            values.put("visit_count", 1)
            db.insertWithOnConflict(TABLE_KNOWN_NETWORKS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
        }
    }

    fun updateKnownNetworkConnection(bssid: String, ip: String?, gateway: String?) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("last_ip", ip)
            put("last_gateway", gateway)
        }
        db.update(TABLE_KNOWN_NETWORKS, values, "bssid = ?", arrayOf(bssid))
    }

    fun getRecentScans(limit: Int): List<ScanHistoryRow> {
        val db = readableDatabase
        val cursor = db.query(
            TABLE_SCAN_HISTORY,
            null, null, null, null, null,
            "scan_id DESC",
            limit.toString(),
        )
        val rows = mutableListOf<ScanHistoryRow>()
        cursor.use {
            while (it.moveToNext()) {
                rows.add(
                    ScanHistoryRow(
                        scanId = it.getLong(it.getColumnIndexOrThrow("scan_id")),
                        timestamp = it.getString(it.getColumnIndexOrThrow("timestamp")),
                        ssid = it.getString(it.getColumnIndexOrThrow("ssid")),
                        bssid = it.getString(it.getColumnIndexOrThrow("bssid")),
                        rssiDbm = it.getInt(it.getColumnIndexOrThrow("rssi_dbm")),
                        latencyMs = it.getDouble(it.getColumnIndexOrThrow("latency_ms")),
                        packetLossPct = it.getDouble(it.getColumnIndexOrThrow("packet_loss_pct")),
                        signalScore = it.getInt(it.getColumnIndexOrThrow("signal_score")),
                        latencyScore = it.getInt(it.getColumnIndexOrThrow("latency_score")),
                        packetlossScore = it.getInt(it.getColumnIndexOrThrow("packetloss_score")),
                        stabilityScore = it.getInt(it.getColumnIndexOrThrow("stability_score")),
                        totalScore = it.getInt(it.getColumnIndexOrThrow("total_score")),
                        status = it.getString(it.getColumnIndexOrThrow("status")),
                        connected = it.getInt(it.getColumnIndexOrThrow("connected")) == 1,
                        snrProxyScore = it.getInt(it.getColumnIndexOrThrow("snr_proxy_score")),
                        switchTriggered = it.getInt(it.getColumnIndexOrThrow("switch_triggered")) == 1,
                        switchAccepted = if (it.isNull(it.getColumnIndexOrThrow("switch_accepted"))) null
                        else it.getInt(it.getColumnIndexOrThrow("switch_accepted")) == 1,
                        cycleState = it.getString(it.getColumnIndexOrThrow("cycle_state")) ?: "MONITORING",
                    )
                )
            }
        }
        return rows
    }

    fun getScanHistoryCount(): Int {
        val db = readableDatabase
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_SCAN_HISTORY", null)
        cursor.use {
            return if (it.moveToFirst()) it.getInt(0) else 0
        }
    }

    fun getKnownNetworks(): List<KnownNetworkRow> {
        val db = readableDatabase
        val cursor = db.query(TABLE_KNOWN_NETWORKS, null, null, null, null, null, "last_seen DESC")
        val rows = mutableListOf<KnownNetworkRow>()
        cursor.use {
            while (it.moveToNext()) {
                rows.add(
                    KnownNetworkRow(
                        bssid = it.getString(it.getColumnIndexOrThrow("bssid")),
                        ssid = it.getString(it.getColumnIndexOrThrow("ssid")),
                        lastIp = it.getString(it.getColumnIndexOrThrow("last_ip")),
                        lastGateway = it.getString(it.getColumnIndexOrThrow("last_gateway")),
                        lastRssiDbm = it.getInt(it.getColumnIndexOrThrow("last_rssi_dbm")),
                        firstSeen = it.getString(it.getColumnIndexOrThrow("first_seen")),
                        lastSeen = it.getString(it.getColumnIndexOrThrow("last_seen")),
                        averageScore = it.getDouble(it.getColumnIndexOrThrow("average_score")),
                        visitCount = it.getInt(it.getColumnIndexOrThrow("visit_count")),
                    )
                )
            }
        }
        return rows
    }

    fun getWeights(): List<WeightRow> {
        val db = readableDatabase
        val cursor = db.query(TABLE_WEIGHTS, null, null, null, null, null, "metric ASC")
        val rows = mutableListOf<WeightRow>()
        cursor.use {
            while (it.moveToNext()) {
                rows.add(
                    WeightRow(
                        metric = it.getString(it.getColumnIndexOrThrow("metric")),
                        weight = it.getDouble(it.getColumnIndexOrThrow("weight")),
                        lastUpdated = it.getString(it.getColumnIndexOrThrow("last_updated")),
                        notes = it.getString(it.getColumnIndexOrThrow("notes")),
                    )
                )
            }
        }
        return rows
    }

    fun updateWeight(metric: String, weight: Double, notes: String) {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("metric", metric)
            put("weight", weight)
            put("last_updated", isoNow())
            put("notes", notes)
        }
        db.insertWithOnConflict(TABLE_WEIGHTS, null, values, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun exportAllAsCsv(): Map<String, String> {
        val scans = getRecentScans(20000)
        val networks = getKnownNetworks()
        val weights = getWeights()
        val switchEvents = getSwitchEvents(20000)

        val scanCsv = buildString {
            appendLine("scan_id,timestamp,ssid,bssid,rssi_dbm,latency_ms,packet_loss_pct,signal_score,latency_score,packetloss_score,stability_score,snr_proxy_score,total_score,status,connected,switch_triggered,switch_accepted,cycle_state")
            scans.forEach { r ->
                appendLine(
                    listOf(
                        r.scanId, csv(r.timestamp), csv(r.ssid), csv(r.bssid), r.rssiDbm, r.latencyMs,
                        r.packetLossPct, r.signalScore, r.latencyScore, r.packetlossScore, r.stabilityScore,
                        r.snrProxyScore, r.totalScore, csv(r.status), if (r.connected) "TRUE" else "FALSE",
                        if (r.switchTriggered) "TRUE" else "FALSE", csv(r.switchAccepted?.toString() ?: ""),
                        csv(r.cycleState),
                    ).joinToString(",")
                )
            }
        }

        val networksCsv = buildString {
            appendLine("bssid,ssid,last_ip,last_gateway,last_rssi_dbm,first_seen,last_seen,average_score,visit_count")
            networks.forEach { r ->
                appendLine(
                    listOf(
                        csv(r.bssid), csv(r.ssid), csv(r.lastIp ?: ""), csv(r.lastGateway ?: ""),
                        r.lastRssiDbm, csv(r.firstSeen), csv(r.lastSeen), r.averageScore, r.visitCount,
                    ).joinToString(",")
                )
            }
        }

        val weightsCsv = buildString {
            appendLine("metric,weight,last_updated,notes")
            weights.forEach { r ->
                appendLine(listOf(csv(r.metric), r.weight, csv(r.lastUpdated), csv(r.notes)).joinToString(","))
            }
        }

        val switchEventsCsv = buildString {
            appendLine("event_id,timestamp,from_ssid,from_bssid,to_ssid,to_bssid,from_total_score,to_total_score,from_stability_score,to_stability_score,accepted,connect_succeeded")
            switchEvents.forEach { r ->
                appendLine(
                    listOf(
                        r.eventId, csv(r.timestamp), csv(r.fromSsid), csv(r.fromBssid), csv(r.toSsid), csv(r.toBssid),
                        r.fromTotalScore, r.toTotalScore, r.fromStabilityScore, r.toStabilityScore,
                        if (r.accepted) "TRUE" else "FALSE", csv(r.connectSucceeded?.toString() ?: ""),
                    ).joinToString(",")
                )
            }
        }

        return mapOf(
            "ScanHistory" to scanCsv,
            "KnownNetworks" to networksCsv,
            "Weights" to weightsCsv,
            "SwitchEvents" to switchEventsCsv,
        )
    }

    private fun csv(value: String): String = "\"${value.replace("\"", "\"\"")}\""

    companion object {
        @Volatile
        private var instance: ResearchDatabase? = null

        fun getInstance(context: Context): ResearchDatabase =
            instance ?: synchronized(this) {
                instance ?: ResearchDatabase(context).also { instance = it }
            }
    }
}

fun isoNow(): String {
    val fmt = java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.US)
    return fmt.format(java.util.Date())
}
