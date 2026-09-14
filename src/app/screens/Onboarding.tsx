import { MapPin, Wifi, Lock } from 'lucide-react';
import { WifiMonitor, isNative } from '../services/nativeWifi';

export const ONBOARDING_STORAGE_KEY = 'wifi-monitor-onboarding-complete';

interface OnboardingProps {
  onComplete: () => void;
}

const permissionCards = [
  {
    icon: MapPin,
    title: 'Location Access',
    body: 'Android requires this to detect nearby WiFi networks. We only use it to scan — never to track your location.',
  },
  {
    icon: Wifi,
    title: 'Nearby WiFi Devices',
    body: 'Lets the app see and switch between access points on the same network.',
  },
  {
    icon: Lock,
    title: 'Everything stays local',
    body: 'No data ever leaves your device.',
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const finish = () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    onComplete();
  };

  const handleContinue = async () => {
    if (isNative()) {
      try {
        await WifiMonitor.requestPermissions();
      } catch (error) {
        console.warn('Permission request failed:', error);
      }
      finish();
      return;
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => finish(),
        () => finish(),
        { timeout: 5000 },
      );
    } else {
      finish();
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background px-6 py-10 overflow-y-auto">
      <div className="relative w-full max-w-md space-y-6">
        <div className="pointer-events-none absolute -top-6 left-1/2 h-20 w-56 -translate-x-1/2 opacity-[0.08]">
          <svg viewBox="0 0 240 64" className="h-full w-full text-accent-signal" fill="none">
            <path
              d="M2 32 C 18 10, 34 10, 50 32 S 82 54, 98 32 S 130 10, 146 32 S 178 54, 194 32 S 226 10, 238 32"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <h1 className="font-display text-center text-[22px] font-semibold text-foreground">
          Before we start scanning
        </h1>

        <div className="space-y-3">
          {permissionCards.map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-2xl border border-border-hairline bg-surface-card p-4"
            >
              <div className="flex items-start gap-3">
                <Icon size={22} className="mt-0.5 shrink-0 text-accent-signal" />
                <div>
                  <p className="text-[15px] font-semibold text-foreground">{title}</p>
                  <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2 pt-2">
          <button
            onClick={handleContinue}
            className="w-full rounded-xl bg-accent-signal py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Continue
          </button>
          <button
            onClick={finish}
            className="w-full py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
