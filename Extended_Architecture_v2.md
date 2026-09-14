# Extended Architecture Document (v2)
## Intelligent WiFi Congestion Monitoring and Recommendation System
### Extension Module: Adaptive Learning + BSSID-Targeted AP Switching + Bandwidth-Heavy Detection + Network Identity Capture

Student: Njabulo Sibambo (223124407) | Supervisor: Dr Bessie Malila
Platform: Android Studio (Kotlin), test on physical device before App Store submission (target: end of October)

Goal of this version: simple, concrete, buildable in one sitting. Each module below tells you the library, the file name, and the exact steps.

---

## 1. Module Overview

| Module | File Name | Library | What It Does |
|---|---|---|---|
| Sensing (existing) | `WifiScanner.kt` | Android `WifiManager` | Lists nearby APs (SSID, BSSID, RSSI) |
| Network Testing (existing) | `NetworkTester.kt` | Android `ConnectivityManager` + `Runtime.exec("ping")` | Measures latency, packet loss |
| Scoring (existing) | `Scorer.kt` | plain Kotlin math | Weighted score, 0.35/0.30/0.20/0.15 |
| **Adaptive Layer (new)** | `AdaptiveWeights.kt` | plain Kotlin, no external library | Nudges the 4 weights based on real outcomes |
| **BSSID Switch Module (new)** | `ApSwitcher.kt` | Android `WifiNetworkSpecifier` + `ConnectivityManager` | Switches to a specific AP (same SSID, different BSSID) |
| **Bandwidth-Heavy Detector (new)** | `TrafficWatcher.kt` | Android `TrafficStats` (built-in) | Detects a burst of data usage, triggers instant re-scan |
| Network Identity Cache (new) | `KnownNetworksDao.kt` | Room (`androidx.room`) | Remembers each BSSID's history |
| Data Storage (existing) | `AppDatabase.kt` | Room | Stores scan history |
| UI (existing) | `MainActivity.kt` / dashboard fragment | Jetpack Compose or XML | Shows scores, recommendation, switch button |

Put all new files in the same package folder as your existing subsystem files, e.g. `app/src/main/java/com/yourpackage/wifimonitor/`. Keep it flat, matching your existing structure — no new folders needed.

---

## 2. BSSID-Targeted AP Switching (corrected)

**Locked in correction:** the target is always a specific BSSID, never just an SSID. This is what makes it "same network, different access point" instead of "different network."

**File:** `ApSwitcher.kt`
**Library:** built into Android — `android.net.wifi.WifiNetworkSpecifier` and `android.net.ConnectivityManager`. No external dependency to add.

**Steps:**
1. In `Scorer.kt`, once you know the best-scoring AP, grab its `bssid` field (already collected in `WifiScanner.kt`).
2. In `ApSwitcher.kt`, build a specifier targeting that exact BSSID:
   `WifiNetworkSpecifier.Builder().setSsid(ssid).setBssid(MacAddress.fromString(bssid)).build()`
3. Wrap it in a `NetworkRequest` with `addTransportType(NetworkCapabilities.TRANSPORT_WIFI)`.
4. Call `connectivityManager.requestNetwork(request, callback)`.
5. Android shows its confirmation dialog automatically — you cannot skip this. Design your UI button as "Switch to Better AP" and let Android handle the popup.
6. In the callback's `onAvailable()`, bind the app's traffic to that network with `connectivityManager.bindProcessToNetwork(network)` and log the switch event with a timestamp.

**Manifest permissions to add:** `ACCESS_FINE_LOCATION`, `CHANGE_WIFI_STATE`, `ACCESS_WIFI_STATE`, and for Android 13+ also `NEARBY_WIFI_DEVICES`.

---

## 3. Bandwidth-Heavy Detection (new feature)

**Goal:** detect the moment a heavy download, stream, or call starts, and immediately trigger a fresh scan and score instead of waiting for the normal interval.

**File:** `TrafficWatcher.kt`
**Library:** `android.net.TrafficStats` — built into Android, zero external dependencies.

**Steps:**
1. Run a small loop (e.g. every 2 seconds via `Handler` or a coroutine `delay(2000)`).
2. Each tick, read `TrafficStats.getTotalRxBytes()` (total bytes received since boot).
3. Compare the new reading to the one from 2 seconds ago.
4. If the difference crosses a threshold (e.g. 500 KB in 2 seconds ≈ 2 Mbps sustained), treat it as "heavy activity started."
5. On threshold crossing, immediately call your existing scan-and-score function — the same one your normal timer calls — instead of waiting for the next cycle.
6. Reset the baseline and keep watching.

**Suggested starting threshold:** 500 KB / 2 seconds. Tune after testing — raise it if it triggers too often during normal browsing, lower it if it misses real downloads.

**Where it plugs in:** it just calls your existing scan-and-score function early — no new scoring logic needed.

---

## 4. Adaptive Scoring Layer (simplified for one-day build)

**File:** `AdaptiveWeights.kt`
**Library:** none needed — plain Kotlin arithmetic. (Skip `river`/Python since you're fully in Android Studio; a hand-rolled version is faster to wire in and still legitimate incremental learning.)

**Steps:**
1. Store the four weights (0.35, 0.30, 0.20, 0.15) in a small Room `weights` table instead of hardcoding them in `Scorer.kt`.
2. After every AP switch (from `ApSwitcher.kt`), wait ~30 seconds, then re-measure the new AP's actual latency and packet loss.
3. Compare: did the metric that most influenced the recommendation (e.g. latency) actually improve as predicted?
4. If yes, nudge that weight up slightly (e.g. +0.01); if no, nudge it down. Keep all four weights normalised so they sum to 1.
5. Save updated weights back to the Room table. `Scorer.kt` reads from this table instead of using fixed constants.

This gives genuine incremental learning with no external ML library — faster to build and easier to defend to your supervisor.

---

## 5. Network Identity Cache

**File:** `KnownNetworksDao.kt`, backed by a Room `@Entity` table `KnownNetwork`.
**Fields:** `bssid` (primary key), `ssid`, `lastIp`, `lastGateway`, `lastRssi`, `firstSeenTimestamp`, `lastSeenTimestamp`, `averageScore`.

**Steps:**
1. Every time `WifiScanner.kt` detects a connection, upsert a row keyed by BSSID.
2. Update `averageScore` as a running average each time that BSSID is scored.
3. Dashboard can then show "this AP has averaged MODERATE over your last 5 visits" using this table.

---

## 6. Splash Screen Fix (still pending)

Unchanged — send me the Logcat error text next time it fails to install, and I'll give you the exact fix rather than guessing.

---

## 7. Build Order for One Sitting

1. `KnownNetworksDao.kt` + Room table — simplest, no dependency on other new modules.
2. `AdaptiveWeights.kt` — wire into existing `Scorer.kt`.
3. `ApSwitcher.kt` — BSSID-targeted switch, add manifest permissions.
4. `TrafficWatcher.kt` — hook into existing scan-and-score function.
5. Connect `ApSwitcher.kt`'s switch events to `AdaptiveWeights.kt`'s outcome-check logic.
6. Fix splash screen once you send the Logcat error.
7. Install on your physical device and test the full loop end to end.

---

## 8. Reality Check (unchanged, still true)

- All of the above is legitimate one-sitting skeleton work.
- Adaptive weights won't show *proven* improvement until the app has run for real over several days — that's a data/time constraint, not a coding one. Let it run passively on your own phone this week.
