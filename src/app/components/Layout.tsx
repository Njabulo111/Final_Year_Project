import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Wifi, BarChart3, Settings, Home, Map as MapIcon, Sun, Moon, Menu, X, Info, ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useTheme } from 'next-themes';
import { useState, useEffect } from 'react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWifiConnected, setIsWifiConnected] = useState(true);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/access-points', icon: Wifi, label: 'Access Points' },
    { path: '/analytics', icon: BarChart3, label: 'History' },
    { path: '/survey', icon: MapIcon, label: 'RF Survey' },
    { path: '/settings', icon: Settings, label: 'Config' },
    { path: '/about', icon: Info, label: 'About' },
  ];

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  if (!isWifiConnected) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-6 text-center">
        <div className="space-y-4 max-w-sm">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <Wifi className="text-red-600" size={40} />
          </div>
          <h2 className="text-2xl font-bold text-foreground">No WiFi Connection</h2>
          <p className="text-muted-foreground">Please connect to a WiFi network to start monitoring and congestion analysis.</p>
          <button
            onClick={() => setIsWifiConnected(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold"
          >
            Check Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <header className="flex-none border-b border-border bg-background sticky top-0 z-50">
        <div className="px-4 py-3 md:px-6 md:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {location.pathname !== '/' && (
                <button
                  onClick={() => navigate(-1)}
                  className="shrink-0 p-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
                  aria-label="Go back"
                >
                  <ChevronLeft size={18} />
                </button>
              )}
              <Link to="/" className="shrink-0 flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-white border border-gray-100 rounded-full overflow-hidden flex items-center justify-center p-1 shadow-sm">
                  <img
                    src="/logo.svg"
                    alt="WiFi Monitor Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="min-w-0 hidden xs:block">
                  <h1 className="text-sm md:text-xl font-bold text-foreground tracking-tight truncate">
                    WiFi Monitor
                  </h1>
                  <p className="text-[9px] md:text-xs text-foreground opacity-50 font-medium truncate">
                    Univ. of Johannesburg
                  </p>
                </div>
              </Link>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className="p-2 rounded-lg bg-muted text-foreground hover:bg-accent transition-colors"
                aria-label="Open menu"
                aria-expanded={isMenuOpen}
              >
                {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {isMenuOpen && (
        <>
          <button
            aria-label="Close navigation drawer"
            className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setIsMenuOpen(false)}
          />
          <motion.aside
            initial={{ x: -24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -24, opacity: 0 }}
            className="fixed left-0 top-0 z-50 h-full w-[82vw] max-w-xs border-r border-border bg-background shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full border border-border bg-white p-1 shadow-sm overflow-hidden">
                  <img src="/logo.svg" alt="WiFi Monitor Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">WiFi Monitor</h2>
                  <p className="text-[11px] text-foreground opacity-60">Navigation</p>
                </div>
              </div>
              <button
                onClick={() => setIsMenuOpen(false)}
                className="p-2 rounded-lg bg-muted text-foreground hover:bg-accent"
                aria-label="Close drawer"
              >
                <X size={18} />
              </button>
            </div>

            <ul className="divide-y divide-border">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center justify-between px-4 py-4 text-sm font-medium transition-colors ${
                        active ? 'text-blue-600 bg-blue-50/60' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={16} />
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </motion.aside>
        </>
      )}

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-24 md:pb-6">
        <div className="mx-auto w-full max-w-6xl min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}
