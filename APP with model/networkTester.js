// Network Tester Service - Measures latency and packet loss using ping
import { execSync } from 'child_process';

class NetworkTester {
  // Test latency and packet loss to a target (e.g., 8.8.8.8 for Google DNS)
  testLatency(target = '8.8.8.8', pingCount = 4) {
    try {
      const output = execSync(`ping -n ${pingCount} ${target}`, {
        encoding: 'utf8',
        timeout: 30000,
      });

      const lines = output.split('\n');
      let minLatency = Infinity;
      let maxLatency = 0;
      let totalLatency = 0;
      let successCount = 0;
      let packetLoss = 0;

      for (const line of lines) {
        // Parse "time=Xms" from ping output
        const timeMatch = line.match(/time[<=]*(\d+)ms/i);
        if (timeMatch) {
          const latency = parseInt(timeMatch[1]);
          minLatency = Math.min(minLatency, latency);
          maxLatency = Math.max(maxLatency, latency);
          totalLatency += latency;
          successCount++;
        }

        // Parse packet loss percentage
        const lossMatch = line.match(/(\d+(?:\.\d+)?)%\s*loss/i);
        if (lossMatch) {
          packetLoss = parseFloat(lossMatch[1]);
        }
      }

      const avgLatency = successCount > 0 ? totalLatency / successCount : 0;

      return {
        minLatency: minLatency === Infinity ? 0 : minLatency,
        maxLatency: maxLatency === 0 ? 0 : maxLatency,
        avgLatency: Math.round(avgLatency),
        packetLoss,
        successCount,
        totalCount: pingCount,
      };
    } catch (error) {
      console.error('Ping test error:', error.message);
      return {
        minLatency: 0,
        maxLatency: 0,
        avgLatency: 0,
        packetLoss: 100,
        successCount: 0,
        totalCount: pingCount,
      };
    }
  }

  // Get metrics for current connection
  getCurrentMetrics() {
    return this.testLatency('8.8.8.8', 4);
  }
}

export default NetworkTester;
