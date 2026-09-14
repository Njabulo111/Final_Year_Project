// WiFi Scanner Service - Uses Windows netsh command to scan networks
import { execSync } from 'child_process';

class WiFiScanner {
  constructor() {
    this.lastScan = null;
    this.scanCache = [];
  }

  // Parse netsh output to extract WiFi networks
  parseNetshOutput(output) {
    const networks = [];
    const lines = output.split('\n');
    let currentNetwork = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // Match SSID lines
      if (trimmed.startsWith('SSID')) {
        if (currentNetwork) {
          networks.push(currentNetwork);
        }
        const ssidMatch = trimmed.match(/SSID\s*:\s*(.+)/);
        currentNetwork = {
          ssid: ssidMatch ? ssidMatch[1].trim() : 'Hidden',
          bssid: '',
          signal: -100,
          channel: 0,
          frequency: 2400,
          securityType: 'Unknown',
        };
      }

      // Match authentication and cipher types
      if (trimmed.startsWith('Authentication')) {
        if (currentNetwork) {
          currentNetwork.securityType = trimmed.split(':')[1]?.trim() || 'Unknown';
        }
      }

      // Match BSSID, signal, and channel in BSSID lines
      if (trimmed.startsWith('BSSID')) {
        const bssidMatch = trimmed.match(/BSSID\s*:\s*([0-9a-fA-F:]+)/);
        if (bssidMatch && currentNetwork) {
          if (currentNetwork.bssid) {
            // We already have data for this network, push and start new
            networks.push({ ...currentNetwork });
          }
          currentNetwork.bssid = bssidMatch[1];
        }
      }

      if (trimmed.startsWith('Signal')) {
        const signalMatch = trimmed.match(/Signal\s*:\s*(\d+)%/);
        if (signalMatch && currentNetwork) {
          // Convert percentage to dBm (rough estimate: -100 to -30 dBm)
          const percentage = parseInt(signalMatch[1]);
          currentNetwork.signal = -100 + (percentage * 0.7);
        }
      }

      if (trimmed.startsWith('Channel')) {
        const channelMatch = trimmed.match(/Channel\s*:\s*(\d+)/);
        if (channelMatch && currentNetwork) {
          currentNetwork.channel = parseInt(channelMatch[1]);
          // Estimate frequency from channel
          if (currentNetwork.channel <= 14) {
            currentNetwork.frequency = 2407 + currentNetwork.channel * 5;
          } else {
            currentNetwork.frequency = 5000 + currentNetwork.channel * 5;
          }
        }
      }
    }

    if (currentNetwork) {
      networks.push(currentNetwork);
    }

    return networks.filter(n => n.bssid && n.ssid !== 'Hidden');
  }

  // Scan for WiFi networks
  scan() {
    try {
      const output = execSync('netsh wlan show networks mode=bssid', {
        encoding: 'utf8',
        timeout: 10000,
      });

      this.scanCache = this.parseNetshOutput(output);
      this.lastScan = new Date();

      // Remove duplicates based on BSSID
      const unique = [];
      const seen = new Set();

      for (const network of this.scanCache) {
        if (!seen.has(network.bssid)) {
          seen.add(network.bssid);
          unique.push(network);
        }
      }

      return unique;
    } catch (error) {
      console.error('WiFi scan error:', error.message);
      return [];
    }
  }

  // Get currently connected network info
  getConnectedNetwork() {
    try {
      const output = execSync('netsh wlan show interfaces', {
        encoding: 'utf8',
        timeout: 5000,
      });

      const lines = output.split('\n');
      const connected = {};

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('SSID')) {
          const match = trimmed.match(/:\s*(.+)/);
          connected.ssid = match ? match[1].trim() : '';
        }
        if (trimmed.startsWith('BSSID')) {
          const match = trimmed.match(/:\s*([0-9a-fA-F:]+)/);
          connected.bssid = match ? match[1].trim() : '';
        }
        if (trimmed.startsWith('Signal Quality')) {
          const match = trimmed.match(/(\d+)%/);
          if (match) {
            connected.signalQuality = parseInt(match[1]);
            connected.signal = -100 + (parseInt(match[1]) * 0.7);
          }
        }
        if (trimmed.startsWith('Channel')) {
          const match = trimmed.match(/:\s*(\d+)/);
          connected.channel = match ? parseInt(match[1]) : 0;
        }
      }

      return connected;
    } catch (error) {
      console.error('Error getting connected network:', error.message);
      return null;
    }
  }
}

export default WiFiScanner;
