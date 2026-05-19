import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageCircle, BookOpen, BarChart3, Settings, Shield } from 'lucide-react';
import { useAdmin } from '../hooks/useAdmin';
import { useLatestInsightAt } from '../hooks/useLatestInsightAt';
import { hasNewInsightsSinceLastView } from '../lib/insightVisibility';
import { HeaderTokenBudget } from './HeaderTokenBudget';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { data: isAdmin } = useAdmin();
  const { data: latestInsight } = useLatestInsightAt();

  const [insightViewVersion, setInsightViewVersion] = useState(0);

  useEffect(() => {
    const handler = () => setInsightViewVersion(v => v + 1);
    window.addEventListener("insights-view-state-changed", handler);
    return () => window.removeEventListener("insights-view-state-changed", handler);
  }, []);

  const badgeVisible = hasNewInsightsSinceLastView(latestInsight?.created_at ?? null);
  console.debug("debug insights badge recompute:", {
    insightViewVersion,
    badgeVisible,
    latestInsightAt: latestInsight?.created_at ?? null,
  });

  const navItems = [
    { path: '/app/chat', icon: MessageCircle, label: 'Chat' },
    { path: '/app/journal', icon: BookOpen, label: 'Diario' },
    { path: '/app/insights', icon: BarChart3, label: 'Insights' },
    { path: '/app/settings', icon: Settings, label: 'Ajustes' },
  ];

  if (isAdmin) {
    navItems.push({ path: '/app/admin', icon: Shield, label: 'Admin' });
  }

  return (
    <div className="min-h-dvh bg-app-bg overflow-x-hidden">
      <header
        className="fixed top-0 left-0 right-0 z-40 bg-app-bg border-b border-app-border flex items-center px-5"
        style={{ height: 'var(--header-h)', paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <img src="/image.png" alt="Tu-Animo" className="w-8 h-8 rounded-full mr-2 flex-shrink-0" />
        <div className="flex items-baseline gap-0.5">
          <span className="text-[18px] font-semibold tracking-tight text-app-text">Tu-Animo</span>
          <span className="text-[18px] font-semibold tracking-tight text-sage-strong">.app</span>
          <span className="text-xs text-app-muted ml-2 hidden sm:inline">
            Tu consejera de IA<span className="ml-1 text-sage-strong/70 font-medium">8.0</span>
          </span>
        </div>
        <div className="ml-auto pr-1">
          <HeaderTokenBudget />
        </div>
      </header>

      <div style={{ paddingTop: 'var(--header-h)', paddingBottom: 'var(--nav-total)' }}>
        {children}
      </div>

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 bg-app-bg px-4 pt-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
      >
        <div className="mx-auto max-w-[620px] bg-app-surface border border-app-border rounded-full shadow-sm px-3 py-2 flex items-center justify-between gap-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location === path;
            const showDot = path === '/app/insights' && badgeVisible && !active;
            return (
              <Link
                key={path}
                href={path}
                className={[
                  'relative flex-1 flex flex-col items-center justify-center gap-[3px]',
                  'min-h-[44px] rounded-full px-2 py-2',
                  'select-none outline-none border',
                  'transition-all duration-[180ms] ease-out',
                  'active:scale-[0.98]',
                  'focus-visible:ring-2 focus-visible:ring-sage-strong/40 focus-visible:ring-offset-1 focus-visible:ring-offset-app-surface',
                  active
                    ? 'bg-sage-strong border-transparent text-white'
                    : 'bg-transparent border-app-border text-app-muted hover:text-app-text',
                ].join(' ')}
              >
                <span className="relative inline-flex">
                  <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  {showDot && (
                    <span className="absolute -top-[3px] -right-[3px] w-[6px] h-[6px] rounded-full bg-sky-400 ring-[1.5px] ring-app-surface" />
                  )}
                </span>
                <span className={`text-[10px] leading-none ${active ? 'font-semibold' : 'font-medium'}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
