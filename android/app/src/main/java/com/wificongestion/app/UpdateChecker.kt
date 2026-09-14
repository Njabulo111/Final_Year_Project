package com.wificongestion.app

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class UpdateInfo(
    val versionCode: Int,
    val versionName: String,
    val releaseNotes: String,
    val downloadUrl: String,
)

/**
 * Checks GitHub Releases for a newer build instead of the Play Store's in-app-update API,
 * which isn't available for a sideloaded app. A release's tag is expected to be `v<versionCode>`
 * (e.g. "v2") matching `android/app/build.gradle`'s `versionCode` — see
 * `.github/workflows/release.yml`, which creates that tag automatically from the same value.
 *
 * Installing the downloaded APK over the running app upgrades it in place (same applicationId,
 * same signing key) with no uninstall and no data loss — the one thing that cannot be removed
 * is Android's own package-installer confirmation dialog; there is no silent-install path
 * outside the Play Store or a device-owner app.
 */
object UpdateChecker {
    private const val REPO = "Njabulo111/Final_Year_Project"
    private const val LATEST_RELEASE_URL = "https://api.github.com/repos/$REPO/releases/latest"

    suspend fun checkForUpdate(currentVersionCode: Int): UpdateInfo? = withContext(Dispatchers.IO) {
        try {
            val json = get(LATEST_RELEASE_URL) ?: return@withContext null
            val obj = JSONObject(json)
            val tag = obj.optString("tag_name", "")
            val remoteVersionCode = tag.removePrefix("v").toIntOrNull() ?: return@withContext null
            if (remoteVersionCode <= currentVersionCode) return@withContext null

            val assets = obj.optJSONArray("assets") ?: return@withContext null
            var apkUrl: String? = null
            for (i in 0 until assets.length()) {
                val asset = assets.getJSONObject(i)
                if (asset.optString("name").endsWith(".apk")) {
                    apkUrl = asset.optString("browser_download_url")
                    break
                }
            }
            val url = apkUrl ?: return@withContext null

            UpdateInfo(
                versionCode = remoteVersionCode,
                versionName = obj.optString("name", tag),
                releaseNotes = obj.optString("body", ""),
                downloadUrl = url,
            )
        } catch (e: Exception) {
            null
        }
    }

    suspend fun downloadUpdate(context: Context, downloadUrl: String): File? = withContext(Dispatchers.IO) {
        try {
            val dir = File(context.cacheDir, "updates").apply { mkdirs() }
            val file = File(dir, "update.apk")
            val connection = openConnection(downloadUrl)
            connection.connectTimeout = 15000
            connection.readTimeout = 60000
            connection.connect()
            if (connection.responseCode !in 200..299) {
                connection.disconnect()
                return@withContext null
            }
            connection.inputStream.use { input ->
                file.outputStream().use { output -> input.copyTo(output) }
            }
            connection.disconnect()
            file
        } catch (e: Exception) {
            null
        }
    }

    fun launchInstaller(context: Context, apkFile: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", apkFile)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
    }

    private fun get(urlStr: String): String? {
        val connection = openConnection(urlStr)
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.connectTimeout = 10000
        connection.readTimeout = 10000
        return try {
            if (connection.responseCode != 200) return null
            connection.inputStream.bufferedReader().use { it.readText() }
        } finally {
            connection.disconnect()
        }
    }

    private fun openConnection(urlStr: String): HttpURLConnection {
        val connection = URL(urlStr).openConnection() as HttpURLConnection
        // GitHub's API rejects requests with no User-Agent header.
        connection.setRequestProperty("User-Agent", "WifiMonitorApp")
        connection.instanceFollowRedirects = true
        return connection
    }
}
