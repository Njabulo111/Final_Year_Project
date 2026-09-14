// API Client for WiFi Congestion Backend
const API_BASE_URL = 'http://localhost:5000/api';

export const api = {
  // Health check
  async health() {
    const res = await fetch(`${API_BASE_URL}/health`);
    return res.json();
  },

  // Scan WiFi networks
  async scan() {
    const res = await fetch(`${API_BASE_URL}/scan`);
    if (!res.ok) {
      throw new Error(`Scan failed: ${res.statusText}`);
    }
    return res.json();
  },

  // Get current metrics
  async metrics() {
    const res = await fetch(`${API_BASE_URL}/metrics`);
    if (!res.ok) {
      throw new Error(`Metrics failed: ${res.statusText}`);
    }
    return res.json();
  },

  // Get configuration
  async config() {
    const res = await fetch(`${API_BASE_URL}/config`);
    if (!res.ok) {
      throw new Error(`Config failed: ${res.statusText}`);
    }
    return res.json();
  },

  // Get history
  async history(limit = 10) {
    const res = await fetch(`${API_BASE_URL}/history?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`History failed: ${res.statusText}`);
    }
    return res.json();
  },
};

export default api;
