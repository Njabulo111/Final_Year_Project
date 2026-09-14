const CONTACT_EMAIL = 'maknkengineers@gmail.com';

const sections = [
  {
    title: 'What this app collects',
    body: 'This app records WiFi network names, signal strength, and connection quality measurements from networks you connect to, purely to calculate and improve recommendations.',
  },
  {
    title: 'Where your data is stored',
    body: 'All data is stored locally on your device in a private database. It is never uploaded, synced, or shared with any server.',
  },
  {
    title: 'What we never do',
    body: 'We never collect your precise GPS location, never share data with third parties, and never use your data for advertising.',
  },
  {
    title: 'Permissions explained',
    body: 'Location access is required by Android to detect nearby WiFi networks and is used only for scanning, never for tracking. Nearby WiFi Devices access lets the app see and switch between access points on the same network.',
  },
];

export function PrivacyPolicy() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div>
        <h2 className="font-display text-2xl font-bold text-foreground">Privacy Policy</h2>
        <p className="mt-1 font-mono text-xs text-muted-foreground">Last updated: August 2026</p>
      </div>

      <div className="space-y-6">
        {sections.map(({ title, body }) => (
          <div key={title}>
            <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
          </div>
        ))}

        <div>
          <h3 className="font-display text-base font-semibold text-foreground">Contact</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Questions about this policy?{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-accent-signal">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
