import { Outlet, useNavigate, useLocation } from 'react-router';
import { ReactNode } from 'react';
import { Home } from 'lucide-react';

const tabs = [
  { label: 'Home',          path: ''              },
  { label: 'Overview',      path: 'benchmarking'  },
  { label: 'Business Case', path: 'business-case' },
];

export function Layout({ children }: { children?: ReactNode }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  const basePath   = location.pathname.split('/')[1];
  const baseRoute  = `/${basePath}`;

  const isActive = (path: string) => {
    const fullPath = path ? `${baseRoute}/${path}` : baseRoute;
    if (path === '') return location.pathname === baseRoute;
    return location.pathname.startsWith(fullPath);
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: '#F4F7FB', fontFamily: "'Inter', sans-serif" }}>

      {/* ── Header ── */}
      <nav className="bg-white shrink-0 flex items-stretch" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, height: 48 }}>

        {/* KPMG logo block + home */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-3 px-5 transition-opacity hover:opacity-75"
          title="Back to Home"
          style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderRightWidth: 1 }}
        >
          <div className="px-2.5 py-1 bg-[#00338D]">
            <span className="text-white font-bold text-[11px] tracking-[0.22em]">KPMG</span>
          </div>
          <span className="text-[12px] font-semibold text-[#0F1C2E] flex items-center gap-1.5 whitespace-nowrap">
            <Home className="w-3.5 h-3.5 text-[#8A95A3]" />
            AI Business Case Tool
          </span>
        </button>

        {/* Tabs */}
        <div className="flex items-stretch ml-1">
          {tabs.map(tab => {
            const active = isActive(tab.path);
            const target = tab.path ? `${baseRoute}/${tab.path}` : baseRoute;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(target)}
                className="px-5 text-[12px] font-semibold h-full transition-colors relative"
                style={{
                  color:           active ? '#00338D' : '#6B7280',
                  backgroundColor: active ? '#F4F7FB' : 'transparent',
                  borderStyle:     'solid',
                  borderWidth:     0,
                  borderBottomWidth: 2,
                  borderColor:     active ? '#00338D' : 'transparent',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#0F1C2E'; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right */}
        <div className="ml-auto flex items-center gap-3 px-5" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderLeftWidth: 1 }}>
          {(basePath === 'demo' || basePath === 'project') && (
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#8A95A3]">
              {basePath === 'demo' ? 'Demo' : 'Project'}
            </span>
          )}
          <span className="text-[10px] text-[#B0BAC8]">v0.3</span>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="flex-1 px-4 pb-4 overflow-auto">
        {children || <Outlet />}
      </main>
    </div>
  );
}
