import { toast } from 'sonner';
import { AccessPoint } from '../types/wifi';

const THROTTLE_KEY_PREFIX = 'wifi-monitor-last-notified-';
const THROTTLE_MS = 10 * 60 * 1000;

export function maybeNotifyCongestion(ap: AccessPoint, onView?: () => void): void {
  const key = `${THROTTLE_KEY_PREFIX}${ap.bssid || ap.id}`;
  const last = Number(localStorage.getItem(key) || 0);
  const now = Date.now();

  if (now - last < THROTTLE_MS) return;

  localStorage.setItem(key, String(now));

  toast.error('Your connection is congested', {
    description: `${ap.ssid} has dropped to a poor score. A better option may be nearby.`,
    action: onView ? { label: 'View', onClick: onView } : undefined,
  });
}
