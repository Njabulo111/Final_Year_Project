# WiFi Congestion Monitoring App - Setup Guide

## Overview
This is a complete WiFi congestion monitoring web application that helps users identify WiFi network issues and get recommendations for better connections.

## System Requirements
- **Windows** (uses `netsh` for WiFi scanning)
- **Node.js** 14+ and npm
- **Admin privileges** (for WiFi network scanning)

## Quick Start

### Option 1: Automatic Setup (Windows)
Simply double-click `start.bat` and the app will:
1. Install all dependencies
2. Start the backend server (port 5000)
3. Start the frontend dev server (port 5173)

### Option 2: Manual Setup

#### Step 1: Install Dependencies
```bash
npm install
```

#### Step 2: Start Backend Server
Open Command Prompt or PowerShell in this directory and run:
```bash
npm run server
```
The backend will start on `http://localhost:5000`

#### Step 3: Start Frontend (in a new terminal)
```bash
npm run dev
```
The frontend will start on `http://localhost:5173`

#### Step 4: Open in Browser
Navigate to `http://localhost:5173`

## Features

### Live Network Monitor Dashboard
- **Real-time WiFi scanning** - Detects nearby access points
- **Performance metrics** - Latency, signal strength, packet loss
- **Intelligent scoring** - Weighted algorithm rates each AP (0-100 scale)
- **Visual dashboard** - Color-coded status (Green/Blue/Orange/Red)
- **Recommendations** - Suggests better APs when available

### Scoring Algorithm
The system calculates a composite score based on:
- **Signal Strength (35%)** - dBm converted to 0-100 scale
- **Latency (30%)** - Measured via ping to 8.8.8.8
- **Packet Loss (20%)** - Estimated from ping tests
- **Stability (15%)** - Connection stability estimate

### Status Classification
- **Excellent** (75-100) - Green - Best performance
- **Good** (60-74) - Blue - Acceptable performance
- **Fair** (50-59) - Orange - Moderate congestion
- **Poor** (<50) - Red - Heavy congestion detected

## Pages

### Dashboard
Main monitoring interface showing:
- Current network metrics
- Access point radar visualization
- Score breakdown by component
- Latency trends over time
- AP score comparison
- Recommendations panel

### Access Points
Detailed list of all detected WiFi networks with:
- SSID and BSSID
- Signal strength and quality
- Current score and status
- Connection state

### Analytics
Historical network performance with:
- Trend charts (24h, 7d, 30d)
- Score and latency graphs
- Average performance metrics
- Time range selection

### Settings
Configuration options for:
- Scoring algorithm weights
- Thresholds for status levels
- Network scanning parameters
- Performance normalization

## Backend API

### Available Endpoints

**Health Check**
```
GET /api/health
```
Returns server status.

**WiFi Scan**
```
GET /api/scan
```
Returns list of all detected WiFi networks with calculated scores.

**Current Metrics**
```
GET /api/metrics
```
Returns performance metrics for current connection.

**Configuration**
```
GET /api/config
```
Returns current scoring configuration.

**Historical Data**
```
GET /api/history?limit=10
```
Returns historical scan data.

## Demo Mode vs Real Data

The app includes two modes:
- **Demo Data** - Uses simulated WiFi networks (no backend required)
- **Real Data** - Scans actual WiFi networks (requires backend running)

Toggle between modes using the button in the top-right of the Dashboard.

## Troubleshooting

### Backend won't connect
- Ensure backend is running: `npm run server`
- Check if port 5000 is available: `netstat -ano | findstr :5000`
- Verify CORS is enabled (it should be)

### No WiFi networks detected
- Run Command Prompt as **Administrator**
- On some systems, `netsh` may require elevated privileges
- Ensure WiFi is enabled and you have at least one network nearby

### Port already in use
- Backend: Change port in `server.js` (default: 5000)
- Frontend: Vite will auto-select another port

### High latency/packet loss in metrics
- This is measured via `ping` to 8.8.8.8
- Poor results indicate actual network issues, not app issues

## Project Structure

```
APP with model/
├── server.js                 # Express backend
├── wifiScanner.js           # WiFi network detection
├── networkTester.js         # Latency/packet loss testing
├── scorer.js                # Scoring algorithm
├── package.json             # Dependencies
├── src/
│   ├── app/
│   │   ├── screens/         # Dashboard, Analytics, etc.
│   │   ├── components/      # UI components
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # Utilities, API client
│   │   └── App.tsx          # Main app
│   ├── styles/              # CSS/Tailwind
│   └── main.tsx             # Entry point
├── index.html               # HTML template
└── vite.config.ts           # Vite configuration
```

## Development Notes

- Frontend: React + TypeScript + Tailwind CSS
- Backend: Node.js + Express
- UI Components: shadcn/ui + Radix UI
- Charts: Recharts
- Animations: Motion (Framer Motion fork)
- Build Tool: Vite

## Performance

- Scan interval: 10 seconds (configurable)
- Ping timeout: 10 seconds per scan
- Data retention: Last 100 scans
- Frontend polling: 10-second intervals

## Limitations

- Windows-only (uses netsh command)
- Requires admin privileges for WiFi scanning
- RSSI/Signal strength affected by environment
- AP location is estimated, not exact
- Cannot force device roaming
- Cannot access hidden AP load data

## Future Enhancements

- [ ] Cross-platform support (Linux/macOS)
- [ ] Mobile app (Android/iOS)
- [ ] ML-based prediction
- [ ] Database storage for long-term analytics
- [ ] Export reports
- [ ] Network comparison tools
