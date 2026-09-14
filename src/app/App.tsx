import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
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
import { isNative } from './services/nativeWifi';
import { recalibrateWeightsFromHistory } from './services/adaptiveWeights';

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
    });

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
