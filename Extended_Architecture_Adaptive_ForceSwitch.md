# Extended Architecture Document
## Intelligent WiFi Congestion Monitoring and Recommendation System
### Extension Module: Adaptive Learning + Assisted AP Switching + Network Identity Capture

Student: Njabulo Sibambo (223124407) | Supervisor: Dr Bessie Malila
Platform target: Android (Android Studio), test device deployment before App Store submission (target: end of October)

---

## 1. Purpose of This Extension

This document extends the original five-subsystem architecture (Sensing, Network Testing, Scoring, Data Storage, User Interface) with three new capabilities:

1. **Adaptive Scoring Module** — the scoring weights adjust over time based on the individual user's actual usage patterns, instead of staying fixed at 35/30/20/15.
2. **Assisted AP Switch Module** — when the algorithm confirms a better AP, the app can trigger an Android switch prompt (one-tap, user-confirmed — Android does not allow a silent forced switch without root/enterprise MDM).
3. **Network Identity Capture Module** — when connected, the app pulls and stores full identifying info about the current network (SSID, BSSID, IP, gateway, etc.) so the system "recognises" the network over time.

A fourth item — the splash screen install failure — is a bug fix, not a new subsystem, and is addressed in Section 6.

**Scope note for your own tracking:** this extension goes beyond the passive-only design your D1/D2 report committed to. Treat this as an "Extended Mode" layered on top of the original passive system, not a replacement of it, so your original submitted design stays intact and defensible.

---

## 2. Updated System Architecture

```
[Sensing] → [Network Testing] → [Scoring] → [Adaptive Layer] → [Data Storage]
                                                   ↓
                                         [Assisted Switch Module]
                                                   ↓
                                         [Network Identity Cache]
                                                   ↓
                                            [User Interface]
```

The original five subsystems are unchanged in function. Three new modules sit alongside them:

| New Module | Sits Between | Role |
|---|---|---|
| Adaptive Layer | Scoring → Storage | Adjusts weights based on historical accuracy of past recommendations |
| Assisted Switch Module | Scoring/UI | Triggers Android network switch prompt on user confirmation |
| Network Identity Cache | Sensing → Storage | Captures and remembers full network identity per AP |

---

## 3. Adaptive Scoring Module

**Goal:** weights (currently fixed at 0.35 / 0.30 / 0.20 / 0.15) shift slightly over time based on which factor best predicted a "good outcome" for this specific user's real sessions.

**Approach:** incremental (online) learning — no big upfront dataset needed, updates one data point at a time as the user uses the app.

**Suggested library:** `river` (Python) if backend logic is prototyped in Python first, or a hand-rolled incremental gradient update in Kotlin/Java if built natively in Android Studio.

**Data flow:**
1. Score is calculated and a recommendation is shown/acted on.
2. App logs the *actual* outcome shortly after (e.g., latency/packet loss measured post-switch).
3. Adaptive layer compares predicted vs actual outcome.
4. Weights nudge slightly toward whichever metric was most predictive.
5. Updated weights are stored locally (SQLite) and used for the next scoring cycle.

**Realistic expectation:** the code/skeleton is buildable in one sitting. The model will not show meaningfully *better* accuracy until it has several days to weeks of real usage data — this is a data/time constraint, not a coding one. Build the skeleton now; let it accumulate data automatically once installed on your phone.

---

## 4. Assisted AP Switch Module (Android)

**API:** `WifiNetworkSpecifier` (Android 10+).

**Reality check:** Android requires user confirmation via a system dialog — there is no way to silently force a switch on a non-rooted, non-enterprise-managed device. Design this as "one-tap confirm" rather than "fully automatic."

**Flow:**
1. Scoring module confirms Network B > Network A by more than your threshold (e.g. 20%).
2. UI shows recommendation with a "Switch Now" button.
3. Tapping it builds a `WifiNetworkSpecifier` request for the target BSSID and calls `ConnectivityManager.requestNetwork()`.
4. Android shows its system confirmation dialog.
5. On confirm, app binds the process to the new network and logs the switch event (for the adaptive module to later check the outcome).

**Permissions needed:** `ACCESS_FINE_LOCATION` (required for WiFi scan results on Android), `CHANGE_WIFI_STATE`, `ACCESS_WIFI_STATE`, `NEARBY_WIFI_DEVICES` (Android 13+).

---

## 5. Network Identity Cache Module

**Goal:** every time the app connects, it pulls and stores full identifying detail about that network, so the system "remembers" it across sessions.

**Fields to capture per connection event:**
- SSID, BSSID
- IP address, gateway IP, subnet mask
- Link speed, frequency/channel, RSSI at connect time
- Timestamp of first-seen and last-seen
- Running tally: average score history for this specific BSSID

**Storage:** add a `known_networks` table in your existing SQLite database, keyed by BSSID, separate from your existing per-scan measurement table. This lets the dashboard eventually say things like "This AP has averaged MODERATE for you over the last 5 visits."

---

## 6. Splash Screen Install Fix

This is unrelated to the above modules — it's a packaging/config bug. Common causes on Android Studio installs:
- Splash image referenced via a theme (`windowSplashScreenAnimatedIcon`) but the drawable isn't in the correct `res/drawable` density folder.
- `minSdkVersion` mismatch with the `SplashScreen` API (only native on API 31+; needs the `androidx.core.splashscreen` library for backward compatibility).
- Icon file too large / wrong format causing a silent install failure.

Send me the exact error from Logcat when you next have it open and I'll pinpoint the fix rather than guessing here.

---

## 7. One-Sitting Build Order (Skeletons Only)

1. Network Identity Cache table + capture logic (simplest, do first)
2. Adaptive Layer skeleton wired into existing scorer.py logic, ported/adapted to Kotlin
3. Assisted Switch Module (WifiNetworkSpecifier flow + permissions + UI button)
4. Wire adaptive layer's outcome-logging to switch events
5. Splash screen fix (once you send the Logcat error)
6. Test full loop on your physical device

---

## 8. What Still Needs Real-World Time (Not Code)

- Adaptive weights won't show *proven* improvement until real usage data accumulates over days.
- Recommend running the app passively on your own phone for at least a week before claiming "improved accuracy" as a result in your report.
