// Express Server - Main entry point for backend
import express from 'express';
import cors from 'cors';
import WiFiScanner from './wifiScanner.js';
import NetworkTester from './networkTester.js';
import Scorer from './scorer.js';

const app = express();
const PORT = 5000;

// Enable CORS
app.use(cors());
app.use(express.json());

// Initialize services
const wifiScanner = new WiFiScanner();
const networkTester = new NetworkTester();
const scorer = new Scorer();

// Store historical data
let scanHistory = [];
let metricsHistory = [];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'WiFi Congestion Backend' });
});

// Get WiFi networks and score them
app.get('/api/scan', (req, res) => {
  try {
    console.log('Scanning WiFi networks...');

    // Get connected network info for reference
    const connectedInfo = wifiScanner.getConnectedNetwork();
    console.log('Connected network:', connectedInfo);

    // Get all visible networks
    const networks = wifiScanner.scan();
    console.log(`Found ${networks.length} networks`);

    // Get current connection metrics
    const metrics = networkTester.getCurrentMetrics();
    console.log('Current metrics:', metrics);

    // Score each network
    const scoredNetworks = networks.map((network, index) => {
      // Simulate stability (in real scenario, track over time)
      const stability = 85 + Math.random() * 15;

      const scoreResult = scorer.calculateScore(
        network.signal,
        metrics.avgLatency || 20,
        metrics.packetLoss || 0,
        stability
      );

      const isConnected =
        connectedInfo && network.bssid === connectedInfo.bssid;

      return {
        id: `ap-${index}`,
        ssid: network.ssid,
        bssid: network.bssid,
        channel: network.channel,
        frequency: network.frequency,
        signal: Math.round(network.signal),
        signalQuality: Math.round(((network.signal + 100) / 70) * 100),
        latency: metrics.avgLatency || 20,
        packetLoss: metrics.packetLoss || 0,
        stability,
        score: scoreResult.overall,
        status: scorer.getStatus(scoreResult.overall),
        isConnected,
        position: {
          angle: (index / Math.max(networks.length, 1)) * 360,
          distance: 0.5 + Math.random() * 0.4,
        },
        lastSeen: new Date(),
        subScores: scoreResult.subScores,
      };
    });

    // Sort by score (best first)
    scoredNetworks.sort((a, b) => b.score - a.score);

    // Store in history (keep last 100)
    scanHistory.push({
      timestamp: new Date(),
      networks: scoredNetworks,
    });
    if (scanHistory.length > 100) {
      scanHistory.shift();
    }

    res.json({
      success: true,
      timestamp: new Date(),
      networks: scoredNetworks,
      scanCount: networks.length,
    });
  } catch (error) {
    console.error('Scan error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get current connection metrics
app.get('/api/metrics', (req, res) => {
  try {
    console.log('Fetching metrics...');

    const connectedInfo = wifiScanner.getConnectedNetwork();
    const metrics = networkTester.getCurrentMetrics();

    // Find the connected network from last scan
    const lastScan = scanHistory[scanHistory.length - 1];
    const connectedAP = lastScan?.networks?.find(n => n.isConnected);

    const result = {
      currentAP: connectedInfo?.ssid || 'Unknown',
      bssid: connectedInfo?.bssid || '',
      signal: connectedInfo?.signal || -100,
      signalQuality: connectedInfo?.signalQuality || 0,
      score: connectedAP?.score || 0,
      latency: metrics.avgLatency,
      packetLoss: metrics.packetLoss,
      trend: 'stable',
      timestamp: new Date(),
    };

    // Store in metrics history
    metricsHistory.push(result);
    if (metricsHistory.length > 100) {
      metricsHistory.shift();
    }

    res.json({
      success: true,
      metrics: result,
    });
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get historical scan data
app.get('/api/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const data = scanHistory.slice(-limit);
    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get current configuration
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    config: scorer.config,
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`WiFi Congestion Backend Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET /api/health - Health check');
  console.log('  GET /api/scan - Scan WiFi networks');
  console.log('  GET /api/metrics - Get current metrics');
  console.log('  GET /api/config - Get configuration');
  console.log('  GET /api/history - Get historical data');
});
