# 🎯 Getting Started - WiFi Congestion Monitoring App

## ⚡ Quick Start (60 seconds)

### Windows Users (Easiest)
1. Double-click **`start.bat`** in this folder
2. Wait for "App is now running!" message
3. Open browser to **http://localhost:5173**
4. Done! 🎉

### All Users (Manual)
```bash
# Terminal 1
npm install
npm run server

# Terminal 2 (new terminal window)
npm run dev
```
Then open http://localhost:5173

---

## 📖 Documentation

### For First-Time Users
- **[RUN.md](./RUN.md)** ← Start here! Full usage guide
- **[SETUP.md](./SETUP.md)** ← Detailed setup instructions

### For Understanding the Project
- **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** ← Complete project overview

---

## 🎮 Using the App

### Step 1: Start in Demo Mode
- App loads with demo WiFi networks
- All features work with simulated data
- Perfect for trying out the interface

### Step 2: Switch to Real Data
- Click the **"Real Data"** button (top-right of Dashboard)
- Backend scans actual WiFi networks near your computer
- Requires: Backend running, Admin privileges on Windows

### Step 3: Explore Features
- **Dashboard**: View live metrics, AP radar, recommendations
- **Access Points**: See detailed list of all networks
- **Analytics**: View trends over time
- **Settings**: Customize the scoring algorithm

---

## 🔍 What You'll See

### Dashboard Page
```
┌─ Live Network Monitor ─────┬─ [Real Data] [Auto-refresh: 10s] ─┐
│                            │                                    │
│ ┌─ Metrics Cards ────────────────────────────────────────────┐ │
│ │ Score: 82/100  Latency: 25ms  Signal: -45dBm  Loss: 0.5% │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─ Access Point Radar ──────────────┬─ Score Breakdown ────┐  │
│ │                                   │ Signal:   85 (35%)   │  │
│ │      🟢 Excellent (82)           │ Latency:  75 (30%)   │  │
│ │  🔵 Good         ℹ️ Fair (50)    │ Loss:     90 (20%)   │  │
│ │    🟠 Moderate                   │ Stability: 95 (15%) │  │
│ │                                   │                      │  │
│ └─────────────────────────────────┴──────────────────────────┘ │
│                                                                 │
│ ┌─ Latency Trend ──────────────────┬─ AP Score Comparison ─┐  │
│ │ Line chart showing 200s history  │ Bar chart of top APs  │  │
│ └─────────────────────────────────┴──────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 🚀 System Requirements

✅ Minimum:
- Windows 7+ (for netsh WiFi commands)
- Node.js 14+ (download from nodejs.org)
- 100 MB free disk space
- WiFi adapter (for real network scanning)

✅ Recommended:
- Windows 10/11
- Node.js 18+
- 500 MB free disk space
- Admin privileges (for WiFi scanning)

---

## 🆘 Quick Troubleshooting

### "Cannot start backend"
```
→ Is Node.js installed? 
  Run: node --version
  
→ Is port 5000 available?
  Close other apps using port 5000
```

### "No WiFi networks detected"
```
→ Run Command Prompt as Administrator
→ Ensure WiFi is enabled
→ Try: netsh wlan show networks mode=bssid
```

### "Frontend won't load"
```
→ Check http://localhost:5173 is accessible
→ Try Ctrl+Shift+Delete to clear browser cache
→ Restart: npm run dev
```

### "High latency showing"
```
→ This is measured to 8.8.8.8 (Google DNS)
→ High = your WiFi actually has latency
→ Try moving closer to router
```

---

## 📊 What Each Metric Means

| Metric | Meaning | Good Value | Bad Value |
|--------|---------|-----------|-----------|
| **Score** | Overall AP quality (0-100) | 75+ | <50 |
| **Latency** | Network delay in ms | <25ms | >100ms |
| **Signal** | WiFi strength in dBm | -45 to -60 | <-80 |
| **Packet Loss** | Lost data % | <1% | >5% |
| **Status** | Category of AP | Green/Blue | Orange/Red |

---

## 💡 Pro Tips

1. **Use Demo Mode First** - Try the interface without setup complexity
2. **Check Recommendations** - Look for "Better AP Available" alerts
3. **Compare Networks** - Use Access Points page to see all options
4. **Review Trends** - Analytics page shows performance patterns
5. **Adjust Weights** - Customize scoring in Settings if desired

---

## 🎓 Learning Path

Beginner → Try Demo Mode
   ↓
Intermediate → Switch to Real Data
   ↓
Advanced → Customize Settings & API
   ↓
Expert → Modify source code

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `start.bat` | Quick launcher |
| `server.js` | Backend server |
| `RUN.md` | Usage guide |
| `PROJECT_SUMMARY.md` | Full overview |
| `src/app/screens/Dashboard.tsx` | Main dashboard |
| `wifiScanner.js` | WiFi detection |
| `scorer.js` | Scoring algorithm |

---

## 🔗 API Endpoints (if needed)

```
http://localhost:5000/api/scan       - Get WiFi networks
http://localhost:5000/api/metrics    - Get current metrics
http://localhost:5000/api/config     - Get configuration
http://localhost:5000/api/health     - Check server status
```

---

## 🎯 Next Steps

1. **[Click to READ: RUN.md](./RUN.md)** - Full usage guide
2. **[Click to READ: SETUP.md](./SETUP.md)** - Detailed setup
3. **Double-click `start.bat`** - Start the app
4. **Open http://localhost:5173** - View dashboard

---

## ✅ Checklist

- [ ] Node.js installed (`node --version` works)
- [ ] In correct directory
- [ ] Ran `npm install` successfully
- [ ] Backend started with `npm run server`
- [ ] Frontend started with `npm run dev`
- [ ] Opened http://localhost:5173 in browser
- [ ] Tested demo data mode
- [ ] Tested real data mode
- [ ] Explored all pages (Dashboard, AP, Analytics, Settings)

---

## 🎉 You're Ready!

Everything is set up and ready to use. Just run the app and start monitoring your WiFi!

**Questions?** Check the documentation files listed above.

**Enjoying it?** Try switching to Real Data mode for actual WiFi scanning!

---

**Last Updated:** May 2024
**Status:** ✅ Complete & Ready to Run
