import { Link, useLocation } from 'react-router';
import { Activity, Wifi, BarChart3, Settings, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/access-points', icon: Wifi, label: 'Access Points' },
    { path: '/analytics', icon: BarChart3, label: 'Analytics' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-[rgb(var(--color-background))]">
      <nav className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-background))]">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                <Activity className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-[rgb(var(--color-foreground))]">
                  WiFi Monitor Pro
                </h1>
                <p className="text-xs text-[rgb(var(--color-foreground))] opacity-50">
                  Real-time Network Intelligence
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link key={item.path} to={item.path}>
                    <motion.div
                      className={`relative px-4 py-2 rounded-lg transition-colors ${
                        active
                          ? 'text-[rgb(var(--color-primary))]'
                          : 'text-[rgb(var(--color-foreground))] opacity-60 hover:opacity-100'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div className="flex items-center gap-2">
                        <Icon size={18} />
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      {active && (
                        <motion.div
                          className="absolute bottom-0 left-0 right-0 h-0.5 bg-[rgb(var(--color-primary))]"
                          layoutId="activeNav"
                          transition={{ duration: 0.3 }}
                        />
                      )}
                    </motion.div>
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm text-[rgb(var(--color-foreground))] opacity-70">
                  Live
                </span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="p-6">{children}</main>
    </div>
  );
}
