import { Info, Shield, Wifi, Activity, BadgeCheck, Mail, ScrollText } from 'lucide-react';

const CONTACT_EMAIL = 'maknkengineers@gmail.com';

const specItems = [
  { label: 'Signal', detail: 'how strong the connection is', icon: Wifi },
  { label: 'Latency', detail: 'how fast it responds', icon: Activity },
  { label: 'Packet Loss', detail: 'how reliable it is', icon: Shield },
  { label: 'Stability', detail: 'how consistent it stays over time', icon: BadgeCheck },
];

export function About() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="rounded-[28px] border border-border-hairline bg-background p-6 shadow-sm">
        <div className="relative overflow-hidden rounded-[24px] border border-border-hairline bg-background/80 px-4 py-10 text-center">
          <div className="pointer-events-none absolute inset-x-0 top-10 mx-auto h-20 w-48 opacity-[0.08]">
            <svg viewBox="0 0 240 64" className="h-full w-full text-accent-signal" fill="none">
              <path d="M2 32 C 18 10, 34 10, 50 32 S 82 54, 98 32 S 130 10, 146 32 S 178 54, 194 32 S 226 10, 238 32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </div>
          <div className="relative z-10 mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border border-border-hairline bg-background shadow-sm">
            <img src="/logo.svg" alt="WiFi Monitor Logo" className="h-12 w-12 object-contain" />
          </div>
          <h2 className="font-display text-[28px] font-bold tracking-tight text-foreground">Intelligent WiFi Monitor</h2>
          <p className="mt-2 text-sm italic text-foreground opacity-70">Smarter WiFi, Better Connections</p>
          <p className="mt-4 font-mono text-[12px] text-muted-foreground">v1.0.0 • Updated Aug 2026</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-border-hairline bg-background p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Info className="text-accent-signal" size={18} />
          <h3 className="font-display text-[16px] font-semibold text-foreground">What It Does</h3>
        </div>
        <p className="text-[14px] leading-6 text-foreground opacity-80">
          This app scans nearby access points and checks their signal strength, speed, and stability in real time. It recommends the best connection available so you spend less time on a slow, overloaded network.
        </p>
      </div>

      <div className="rounded-[24px] border border-border-hairline bg-background p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Activity className="text-accent-signal" size={18} />
          <h3 className="font-display text-[16px] font-semibold text-foreground">How It&apos;s Scored</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {specItems.map(({ label, detail, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-border-hairline bg-surface-card/60 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon size={15} className="text-accent-signal" />
                {label}
              </div>
              <p className="mt-1 text-[13px] text-foreground opacity-65">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-accent-signal/20 bg-accent-signal/5 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="text-accent-signal" size={18} />
          <h3 className="font-display text-[16px] font-semibold text-foreground">Privacy</h3>
        </div>
        <p className="text-[14px] leading-6 text-foreground opacity-80">
          All scanning and scoring happens on your device. No data is uploaded or shared with any external server.
        </p>
      </div>

      <div className="rounded-[24px] border border-border-hairline bg-background p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <BadgeCheck className="text-accent-signal" size={18} />
          <h3 className="font-display text-[16px] font-semibold text-foreground">Project Info</h3>
        </div>
        <div className="space-y-2 font-mono text-[12px] text-muted-foreground">
          <p>Njabulo Sibambo</p>
          <p>Student Number: 223124407</p>
          <p>University of Johannesburg</p>
          <p>Department of Electrical and Electronic Engineering Science</p>
          <p>Supervisor: Dr Bessie Malila</p>
        </div>
      </div>

      <div className="rounded-[24px] border border-border-hairline bg-background p-4 text-center text-[12px] text-muted-foreground">
        <p>Built with React &amp; Capacitor</p>
        <div className="mt-3 flex items-center justify-center gap-4">
          <a href={`mailto:${CONTACT_EMAIL}`} className="inline-flex items-center gap-1 font-medium text-accent-signal">
            <Mail size={14} />
            Contact
          </a>
          <button className="inline-flex items-center gap-1 font-medium text-accent-signal">
            <ScrollText size={14} />
            Licenses
          </button>
        </div>
      </div>
    </div>
  );
}
