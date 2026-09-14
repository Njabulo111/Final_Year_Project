import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster, toast } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { useEffect, useState } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import { Layout } from './components/Layout';
import { Dashboard } from './screens/Dashboard';
import { AccessPoints } from './screens/AccessPoints';
import { Analytics } from './screens/Analytics';
import { Settings } from './screens/Settings';
import { SiteSurvey } from './screens/SiteSurvey';
import { About } from './screens/About';
import { PrivacyPolicy } from './screens/PrivacyPolicy';
import { Onboarding, ONBOARDING_STORAGE_KEY } from './screens/Onboarding';
import { WifiMonitor, isNative } from './services/nativeWifi';
import { recalibrateWeightsFromHistory } from './services/adaptiveWeights';

/**
 * The background monitor's switch state machine (see SwitchStateMachine.kt) fires a
 * recommendation with only a BSSID/SSID/score snapshot — not a full hydrated AccessPoint
 * (no live packetLoss/channel/subScores, since candidates are only ever scanned, never
 * connected to). Rather than fabricate those fields for the detailed RecommendationModal,
 * this uses a plain confirm toast: honest about what's actually known, and still satisfies
 * the "no silent switch" requirement — the user always confirms before anything happens.
 */
const UPDATE_CHECK_STORAGE_KEY = 'wifi-monitor:last-update-check';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // once/day — stays well inside GitHub's unauthenticated API rate limit

/** Checks GitHub Releases for a newer build and offers to download + install it in place. */
async function checkForAppUpdate() {
  if (!isNative()) return;

  let lastCheck = 0;
  try {
    lastCheck = Number(localStorage.getItem(UPDATE_CHECK_STORAGE_KEY) ?? 0);
  } catch {
    // localStorage unavailable; just check every time rather than blocking the feature
  }
  if (Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return;

  try {
    const result = await WifiMonitor.checkForUpdate();
    try {
      localStorage.setItem(UPDATE_CHECK_STORAGE_KEY, String(Date.now()));
    } catch {
      // best-effort throttle only
    }
    if (!result.updateAvailable || !result.downloadUrl) return;

    toast(`Update available: ${result.versionName ?? 'new version'}`, {
      id: 'app-update',
      duration: Infinity,
      description: result.releaseNotes || 'A new version is ready to install.',
      action: {
        label: 'Update',
        onClick: async () => {
          toast.loading('Downloading update…', { id: 'app-update-download' });
          try {
            await WifiMonitor.downloadAndInstallUpdate({ downloadUrl: result.downloadUrl! });
            toast.success('Opening installer…', { id: 'app-update-download' });
          } catch {
            toast.error('Update download failed — try again later.', { id: 'app-update-download' });
          }
        },
      },
      cancel: { label: 'Later', onClick: () => {} },
    });
  } catch {
    // network/API failure — silently skip, next throttle window will retry
  }
}

async function checkPendingSwitchRecommendation() {
  if (!isNative()) return;
  const rec = await WifiMonitor.getPendingSwitchRecommendation();
  if (!rec.pending || !rec.targetSsid || !rec.targetBssid) return;

  // sonner fires onDismiss for every toast removal, including one already resolved by the
  // action/cancel button — guard so the native side only hears about the outcome once.
  let responded = false;
  const respondOnce = (accepted: boolean, connectSucceeded?: boolean) => {
    if (responded) return;
    responded = true;
    void WifiMonitor.respondToSwitchRecommendation({ accepted, connectSucceeded });
  };

  toast(`Better WiFi nearby: "${rec.targetSsid}"`, {
    id: 'switch-recommendation',
    duration: 30000,
    description: `Your current connection has been unstable (stability ${Math.round(rec.currentStability ?? 0)}/100). "${rec.targetSsid}" looks steadier (score ${Math.round(rec.targetScore ?? 0)} vs ${Math.round(rec.currentScore ?? 0)}).`,
    action: {
      label: 'Switch',
      onClick: async () => {
        try {
          const result = await WifiMonitor.switchToBssid({ ssid: rec.targetSsid!, bssid: rec.targetBssid! });
          respondOnce(true, result.success);
          if (result.success) {
            toast.success(`Switched to ${rec.targetSsid}`);
          } else {
            toast.error(`Could not switch to ${rec.targetSsid}`);
          }
        } catch {
          respondOnce(true, false);
          toast.error('Switch failed.');
        }
      },
    },
    cancel: {
      label: 'Not now',
      onClick: () => respondOnce(false),
    },
    onDismiss: () => respondOnce(false),
  });
}

export default function App() {
  const [showWelcome, setShowWelcome] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(
    () => localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1',
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setShowWelcome(false), 4000);
    return () => window.clearTimeout(timer);
  }, []);

  // Re-show the welcome screen every time the app is brought back to the
  // foreground, not just on a cold process start (MainActivity is
  // singleTask, so returning from background never remounts this tree).
  useEffect(() => {
    if (!isNative()) return;

    const listenerPromise = CapacitorApp.addListener('resume', () => {
      setShowWelcome(true);
      window.setTimeout(() => setShowWelcome(false), 4000);
      void checkPendingSwitchRecommendation();
    });

    void checkPendingSwitchRecommendation();
    void checkForAppUpdate();

    return () => {
      void listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  // Recalibrate scoring weights from accumulated on-device scan history:
  // once shortly after startup, then periodically while the app is open.
  useEffect(() => {
    if (!isNative()) return;

    void recalibrateWeightsFromHistory();
    const interval = window.setInterval(() => {
      void recalibrateWeightsFromHistory();
    }, 3 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, []);

  if (!isOnboarded) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <Onboarding onComplete={() => setIsOnboarded(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Router>
        {showWelcome && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-background text-center px-6">
            <img src="/logo.svg" alt="WiFi Monitor Logo" className="w-40 h-40 rounded-3xl object-contain shadow-lg" />
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">Welcome to Wi-Fi Congestion Monitor and Access Point Intelligence App</h1>
              <p className="max-w-lg text-sm md:text-base text-muted-foreground">
                Your Android-ready Wi-Fi access point monitoring and congestion analysis app.
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/70 tracking-wide">
              By NN Sibambo under supervision of Dr Bessi
            </p>
          </div>
        )}

        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/access-points" element={<AccessPoints />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/survey" element={<SiteSurvey />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/about" element={<About />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
          </Routes>
        </Layout>
        <Toaster position="top-right" richColors />
      </Router>
    </ThemeProvider>
  );
}
