import { useNavigate } from 'react-router';
import {
  ArrowRight, Database, BarChart2, TrendingUp,
  LayoutDashboard, Users, Search, Sliders,
} from 'lucide-react';
import bridgeImg from '@/imports/image-17.png';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';

/*
  Palette:
  — KPMG Blue      #00338D
  — KPMG Cobalt    #1E49E2
  — KPMG Pink      #FD349C
  — Bridge Navy    #1A2B60  (dark structure in the photo)
  — Bridge Periwinkle #6B7EC8 (cables)
  — Bridge Lavender   #C8CEED (sky)
  — Ink / text     #0F1C2E
  — Body text      #3D4A5C
*/

export function LandingPage() {
  const navigate = useNavigate();
  const go = () => navigate('/project');

  return (
    <div className="min-h-screen flex flex-col bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ─── HEADER ─── */}
      <header className="bg-white sticky top-0 z-50" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1 }}>
        <div className="max-w-7xl mx-auto px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-[#00338D]">
              <span className="text-white font-bold text-sm tracking-[0.22em]">KPMG</span>
            </div>
            <div className="w-px h-5 bg-[#DDE3ED]" />
            <span className="text-[13px] font-semibold text-[#0F1C2E]">AI Business Case Tool</span>
          </div>
          <div className="flex items-center gap-7">
            <span className="text-[10px] tracking-[0.18em] uppercase font-medium text-[#8A95A3]">
              Powered by KPMG Analytics
            </span>
            <button onClick={go}
              className="text-[12px] font-bold px-5 py-2.5 text-white bg-[#00338D] hover:bg-[#002d7a] transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </header>

      {/* ─── HERO ─── */}
      <section className="flex">

        {/* Left — copy on dark navy */}
        <div className="relative flex flex-col justify-center px-16 py-12 bg-[#1A2B60]" style={{ flex: '0 0 50%' }}>
          {/* Subtle vertical rule decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-px bg-white/10" />

          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#C8CEED] mb-7">
            AI-Powered Decision Intelligence
          </p>

          <h1 className="text-[2.6rem] font-bold leading-[1.13] text-white mb-6"
            style={{ letterSpacing: '-0.022em' }}>
            From operational data<br />
            to investment-ready<br />
            <span className="text-[#C8CEED]">AI business cases.</span>
          </h1>

          <p className="text-[15px] leading-relaxed mb-10 text-white/60 max-w-[380px]">
            Quantify automation potential across Procure-to-Pay, Order-to-Cash and Record-to-Report using client-specific data,
            industry benchmarks and live scenario calculations.
          </p>

          <div className="flex items-center gap-5">
            <button onClick={go}
              className="inline-flex items-center gap-2 text-[13px] font-bold px-7 py-3.5 bg-white text-[#00338D] hover:bg-[#EEF3FB] transition-colors">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#FD349C]" />
        </div>

        {/* Right — bridge photo at full natural proportions, no crop */}
        <div style={{ flex: '0 0 50%', backgroundColor: '#C8CEED' }}>
          <img
            src={bridgeImg}
            alt="Cable-stayed bridge viewed from below — structural precision"
            style={{ display: 'block', width: '100%', height: 'auto' }}
          />
        </div>
      </section>

      {/* ─── WHY THIS TOOL (blue strip) ─── */}
      <section className="bg-[#00338D]">
        <div className="max-w-7xl mx-auto px-10 py-8 grid grid-cols-4"
          style={{ borderColor: 'rgba(255,255,255,0.15)' }}>
          {[
            {
              icon: <Users className="w-4 h-4" strokeWidth={1.5} />,
              title: 'Client-specific baseline',
              body: 'Anchored in real client data — revenue, FTEs, invoice volumes and process scope.',
              accent: '#C8CEED',
            },
            {
              icon: <Search className="w-4 h-4" strokeWidth={1.5} />,
              title: 'Benchmark-driven analysis',
              body: 'Missing data? Our benchmarks provide a reliable alternative – so you can move forward without delays.',
              accent: '#C8CEED',
            },
            {
              icon: <Sliders className="w-4 h-4" strokeWidth={1.5} />,
              title: 'Dynamic scenario modeling',
              body: 'Explore, compare, and save different scenarios live – flexibly and collaboratively with the client.',
              accent: '#FD349C',
            },
            {
              icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />,
              title: 'Create new business case calculator',
              body: 'Build and customize new calculators for any business case – tailored to your needs.',
              accent: '#FD349C',
            },
          ].map(({ icon, title, body, accent }, i) => (
            <div key={title} className="px-8 first:pl-0 last:pr-0 flex flex-col gap-2"
              style={{ borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'solid', borderWidth: 0, borderLeftWidth: i > 0 ? 1 : 0 }}>
              <div className="flex items-center gap-2 mb-1">
                <div style={{ color: accent, width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
                <span className="text-[11px] font-bold tracking-wide text-white">{title}</span>
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── MODULES ─── */}
      <section className="bg-[#F4F7FB]" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1 }}>
        <div className="max-w-7xl mx-auto px-10 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-[#FD349C]" />
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#FD349C]">How it works</span>
            </div>
            <button onClick={go}
              className="text-[12px] font-bold px-5 py-2 border-2 border-[#00338D] text-[#00338D] hover:bg-[#00338D] hover:text-white transition-colors">
              Open tool →
            </button>
          </div>

          <div className="grid grid-cols-4" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderTopWidth: 1 }}>
            {[
              { n: '01', accent: '#00338D', icon: <Users className="w-4 h-4" strokeWidth={1.5} />,          title: 'Tailored Profile Setup',   body: 'Define client, industry, revenue, FTEs and target processes with benchmark auto-calculation.' },
              { n: '02', accent: '#6B7EC8', icon: <Search className="w-4 h-4" strokeWidth={1.5} />,          title: 'Benchmarking & Deep Dive', body: 'Compare KPIs against sub-industry benchmarks. Drill into L2/L3 subprocess performance.' },
              { n: '03', accent: '#1E49E2', icon: <Sliders className="w-4 h-4" strokeWidth={1.5} />,         title: 'Use Case Value Drivers',   body: 'Model any use case. Activate value drivers and quantify FTE and cost impact.' },
              { n: '04', accent: '#FD349C', icon: <LayoutDashboard className="w-4 h-4" strokeWidth={1.5} />, title: 'Results & Dashboard',      body: 'View NPV, ROI, payback period, TCO and 5-year cash flows. Switch scenarios in real time.' },
            ].map(({ n, accent, icon, title, body }, i) => (
              <div key={n} onClick={go}
                className="group cursor-pointer px-8 py-6 first:pl-0 last:pr-0 flex flex-col gap-2 hover:bg-white transition-colors"
                style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderLeftWidth: i > 0 ? 1 : 0 }}>
                <div className="flex items-center gap-2 mb-1">
                  <div style={{ color: accent, width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {icon}
                  </div>
                  <span className="text-[11px] font-bold text-[#0F1C2E]">{title}</span>
                </div>
                <p className="text-[12px] leading-relaxed text-[#6B7280]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PROCESS STRIP ─── */}
      <section className="bg-[#F4F7FB]" style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1 }}>
        <div className="max-w-7xl mx-auto px-10 py-5 flex items-center gap-8">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#8A95A3]">
            Covered processes
          </span>
          <div className="w-px h-4 bg-[#DDE3ED]" />
          {[
            { abbr: 'P2P', label: 'Procure-to-Pay',   color: '#00338D' },
            { abbr: 'O2C', label: 'Order-to-Cash',     color: '#6B7EC8' },
            { abbr: 'R2R', label: 'Record-to-Report',  color: '#1E49E2' },
          ].map(({ abbr, label, color }) => (
            <div key={abbr} className="flex items-center gap-2">
              <span className="text-[9px] font-black px-1.5 py-0.5 text-white tracking-widest"
                style={{ backgroundColor: color }}>{abbr}</span>
              <span className="text-[13px] font-medium text-[#0F1C2E]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="bg-[#1A2B60] relative overflow-hidden">
        {/* Periwinkle accent stripe */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[#6B7EC8]" />
        {/* Pink side bar */}
        <div className="absolute top-0 right-0 bottom-0 w-[3px] bg-[#FD349C]" />

        <div className="max-w-7xl mx-auto px-10 py-16 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-[#C8CEED] mb-4">
              Ready to begin?
            </p>
            <h2 className="text-[1.75rem] font-bold text-white mb-2" style={{ letterSpacing: '-0.015em' }}>
              Build your investment-ready<br />AI business case today.
            </h2>
            <p className="text-[13px] text-white/55">
              Start with client data. Get structured financial outputs in minutes.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button onClick={go}
              className="inline-flex items-center gap-2 text-[13px] font-bold px-8 py-4 bg-white text-[#00338D] hover:bg-[#EEF3FB] transition-colors whitespace-nowrap">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="bg-[#0F1C2E]">
        <div className="max-w-7xl mx-auto px-10 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 bg-[#00338D]">
              <span className="text-white font-bold text-[11px] tracking-[0.22em]">KPMG</span>
            </div>
            <span className="text-[11px] text-white/30">AI Business Case Tool</span>
          </div>
          <span className="text-[11px] text-white/20">
            © 2025 KPMG — Confidential, for internal use only
          </span>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-4 h-0.5" style={{ backgroundColor: color }} />
      <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color }}>{label}</span>
    </div>
  );
}
