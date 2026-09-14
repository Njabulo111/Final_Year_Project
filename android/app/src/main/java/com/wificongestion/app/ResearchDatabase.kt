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
private const val DB_VERSION = 1

private const val TABLE_SCAN_HISTORY = "scan_history"
private const val TABLE_KNOWN_NETWORKS = "known_networks"
private const val TABLE_WEIGHTS = "weights"

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
                connected INTEGER
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

        seedDefaultWeights(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE_SCAN_HISTORY")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_KNOWN_NETWORKS")
        db.execSQL("DROP TABLE IF EXISTS $TABLE_WEIGHTS")
        onCreate(db)
    }

    private fun seedDefaultWeights(db: SQLiteDatabase) {
        val now = isoNow()
        val defaults = listOf(
            WeightRow("signal", 0.35, now, "Initial default weight from D1/D2 report"),
            WeightRow("latency", 0.30, now, "Initial default weight from D1/D2 report"),
            WeightRow("loss", 0.20, now, "Initial default weight from D1/D2 report"),
            WeightRow("stability", 0.15, now, "Initial default weight from D1/D2 report"),
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
        }
        db.insert(TABLE_SCAN_HISTORY, null, values)

        upsertKnownNetwork(row)
        trimScanHistory(db, maxRows = 20000)
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

        val scanCsv = buildString {
            appendLine("scan_id,timestamp,ssid,bssid,rssi_dbm,latency_ms,packet_loss_pct,signal_score,latency_score,packetloss_score,stability_score,total_score,status,connected")
            scans.forEach { r ->
                appendLine(
                    listOf(
                        r.scanId, csv(r.timestamp), csv(r.ssid), csv(r.bssid), r.rssiDbm, r.latencyMs,
                        r.packetLossPct, r.signalScore, r.latencyScore, r.packetlossScore, r.stabilityScore,
                        r.totalScore, csv(r.status), if (r.connected) "TRUE" else "FALSE",
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

        return mapOf(
            "ScanHistory" to scanCsv,
            "KnownNetworks" to networksCsv,
            "Weights" to weightsCsv,
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
