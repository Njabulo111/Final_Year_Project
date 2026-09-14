import { WifiOff, Terminal, RefreshCw } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  onRetry?: () => void;
}

export function EmptyState({ onRetry }: EmptyStateProps) {
  const diagnosticOutput = `C:\\> netsh wlan show networks

Interface name : Wi-Fi
There are 0 networks currently visible.

C:\\> netsh wlan show interfaces

There is no wireless interface on the system.

C:\\> ipconfig /all

Windows IP Configuration

   Host Name . . . . . . . . . . . . : DESKTOP-PC
   Primary Dns Suffix  . . . . . . . :
   Node Type . . . . . . . . . . . . : Hybrid
   IP Routing Enabled. . . . . . . . : No
   WINS Proxy Enabled. . . . . . . . : No

Ethernet adapter Ethernet:

   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : Intel(R) Ethernet Connection
   Physical Address. . . . . . . . . : 00-1A-2B-3C-4D-5E
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes

Wireless LAN adapter Wi-Fi:

   Media State . . . . . . . . . . . : Media disconnected
   Connection-specific DNS Suffix  . :
   Description . . . . . . . . . . . : Intel(R) Wi-Fi 6 AX200
   Physical Address. . . . . . . . . : AA-BB-CC-DD-EE-FF
   DHCP Enabled. . . . . . . . . . . : Yes
   Autoconfiguration Enabled . . . . : Yes

C:\\> netsh wlan show drivers

Interface name: Wi-Fi

    Driver                    : Intel(R) Wi-Fi 6 AX200 160MHz
    Vendor                    : Intel Corporation
    Provider                  : Intel
    Date                      : 2025-01-15
    Version                   : 23.80.1.2
    INF file                  : netwtw10.inf
    Type                      : Native Wi-Fi Driver
    Radio types supported     : 802.11b 802.11g 802.11n 802.11ac 802.11ax
    FIPS 140-2 mode supported : Yes
    802.11w Management Frame Protection supported : Yes
    Hosted network supported  : Yes
    Authentication and cipher supported in infrastructure mode:
                                Open            None
                                WPA2-Personal   CCMP
                                WPA2-Enterprise CCMP
                                Vendor defined  Vendor defined
                                Vendor defined  CCMP
                                WPA3-SAE        CCMP
                                WPA3-Enterprise CCMP

POSSIBLE ISSUES:
• Wi-Fi adapter is present but no networks detected
• Adapter may be disabled or in airplane mode
• No access points in range (distance/interference)
• Driver or firmware issue
• Physical antenna connection problem`;

  return (
    <div className="flex items-center justify-center min-h-[600px]">
      <motion.div
        className="max-w-4xl w-full space-y-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="text-center space-y-4 mb-8">
          <motion.div
            className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-full"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <WifiOff size={48} className="text-orange-600" />
          </motion.div>

          <div>
            <h2 className="text-3xl font-bold text-[rgb(var(--color-foreground))] mb-2">
              No Access Points Detected
            </h2>
            <p className="text-[rgb(var(--color-foreground))] opacity-60 max-w-md mx-auto">
              Unable to detect any Wi-Fi access points in range. Check the diagnostic output below
              for troubleshooting information.
            </p>
          </div>

          {onRetry && (
            <motion.button
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <RefreshCw size={18} />
              Retry Scan
            </motion.button>
          )}
        </div>

        <div className="bg-[rgb(var(--color-background))] border border-[rgb(var(--color-border))] rounded-xl overflow-hidden shadow-lg">
          <div className="bg-[rgb(var(--color-muted))] px-6 py-4 border-b border-[rgb(var(--color-border))]">
            <div className="flex items-center gap-3">
              <Terminal size={20} className="text-[rgb(var(--color-foreground))] opacity-70" />
              <h3 className="font-semibold text-[rgb(var(--color-foreground))]">
                Network Diagnostic Output
              </h3>
            </div>
            <p className="text-sm text-[rgb(var(--color-foreground))] opacity-60 mt-1">
              Raw output from Windows netsh commands for IT debugging
            </p>
          </div>

          <div className="p-6 max-h-[500px] overflow-y-auto">
            <pre className="font-mono text-xs text-[rgb(var(--color-foreground))] whitespace-pre-wrap leading-relaxed">
              {diagnosticOutput}
            </pre>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="font-semibold text-[rgb(var(--color-foreground))] mb-2">
              Check Adapter
            </h4>
            <p className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
              Ensure Wi-Fi adapter is enabled and not in airplane mode
            </p>
          </div>

          <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
            <h4 className="font-semibold text-[rgb(var(--color-foreground))] mb-2">
              Check Range
            </h4>
            <p className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
              Move closer to access points or check for interference
            </p>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
            <h4 className="font-semibold text-[rgb(var(--color-foreground))] mb-2">
              Check Drivers
            </h4>
            <p className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
              Update Wi-Fi adapter drivers to the latest version
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
