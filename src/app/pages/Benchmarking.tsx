import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { Info, Pencil, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PROCESSES, SUBPROCESS_COLORS } from '../data/mockData';

function aiPotentialPct(key: string) {
  // Deterministic varied percentage per KPI name, range 45-80%.
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return 45 + (h % 36);
}

function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
      <span>{title}</span>
      {right}
    </div>
  );
}

function ArrowFlow({
  steps,
  selectedSteps = [],
  clickable = false,
  onToggle,
  disabledSteps = [],
}: {
  steps: string[];
  selectedSteps?: string[];
  clickable?: boolean;
  onToggle?: (step: string) => void;
  disabledSteps?: string[];
}) {
  return (
    <div className="flex flex-wrap items-center">
      {steps.map((step, i) => {
        const isFirst = i === 0;
        const isLast = i === steps.length - 1;
        const isDisabled = disabledSteps.includes(step);
        const isActive = selectedSteps.includes(step) || !clickable;

        const clipPath = isFirst
          ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)'
          : isLast
          ? 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)'
          : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)';

        const interactive = clickable && !isDisabled;
        const baseColor = isDisabled
          ? 'bg-gray-300 text-gray-500'
          : clickable
          ? isActive
            ? 'bg-[#00338D] text-white'
            : 'bg-[#00A3E0]/60 text-white hover:bg-[#00A3E0]'
          : 'bg-[#00338D] text-white';

        return (
          <button
            key={step}
            onClick={interactive && onToggle ? () => onToggle(step) : undefined}
            disabled={isDisabled}
            title={isDisabled ? 'Out of P2P scope' : undefined}
            style={{
              clipPath,
              marginLeft: isFirst ? 0 : -10,
              paddingLeft: isFirst ? 10 : 20,
              paddingRight: isLast ? 10 : 20,
              cursor: interactive ? 'pointer' : isDisabled ? 'not-allowed' : 'default',
            }}
            className={`py-1.5 text-xs font-medium whitespace-nowrap transition-colors mb-1 ${baseColor}`}
          >
            {step}
          </button>
        );
      })}
    </div>
  );
}

// Fixed FTE allocation percentages per subprocess (KPMG project averages)
// Process-level allocation: % of total (P2P) Client FTEs allocated to each main process.
const SUBPROCESS_FTE_ALLOCATION: Record<string, number> = {
  'Requisitioning':              0.30,
  'Purchasing':                  0.19,
  'Receiving':                   0.16,
  'Invoice Processing & Payment': 0.35,
};

function AllocationTooltip({ step, processId }: { step: string; processId: string }) {
  return (
    <span className="relative inline-flex items-center group ml-1 align-middle">
      <Info size={11} className="text-gray-400 cursor-help" />
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 hidden group-hover:block bg-white text-gray-700 text-[10px] leading-relaxed rounded-md px-3 py-2 w-64 whitespace-normal shadow-xl border border-gray-200">
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
        <span className="relative">
          The division of FTEs working on {processId} across their respective subprocesses is based on the average of KPMG&apos;s completed projects.
        </span>
      </span>
    </span>
  );
}

function L3SummaryCards({ processId, selectedSteps, automationOverrides }: {
  processId: string;
  selectedSteps: string[];
  automationOverrides: Record<string, string>;
}) {
  const { fteValues } = useApp();
  const proc = PROCESSES[processId];
  if (!proc || selectedSteps.length === 0) return null;

  const totalProcessFTEs = parseFloat((fteValues[processId] || {})['fte'] || '') || null;

  const cards = selectedSteps.map(step => {
    const kpis = proc.l3KPIs[step] || [];
    const allocationPct = SUBPROCESS_FTE_ALLOCATION[step] ?? null;
    const l1ClientFTE = (totalProcessFTEs !== null && allocationPct !== null)
      ? totalProcessFTEs * allocationPct
      : null;

    // Aggregate Level-2 client FTE and FTE savings for this step
    let sumL2ClientFTE = 0;
    let sumL2FTESavings = 0;
    kpis.forEach(kpi => {
      const l4Key = kpi.l4 ?? '';
      const l4AllocPct = L4_FTE_ALLOCATION[l4Key] ?? null;
      const l4ClientFTE = (l1ClientFTE !== null && l4AllocPct !== null)
        ? l1ClientFTE * l4AllocPct
        : null;
      const assignment = AI_TOOL_ASSIGNMENTS[l4Key] ?? null;
      // Use user override if present, otherwise fall back to default
      const overrideStr = automationOverrides[l4Key];
      const automationPct = assignment
        ? (overrideStr !== undefined ? parseFloat(overrideStr) / 100 : assignment.defaultPct)
        : null;
      const l4FTESavings = (l4ClientFTE !== null && automationPct !== null)
        ? automationPct * l4ClientFTE
        : null;
      if (l4ClientFTE !== null) sumL2ClientFTE += l4ClientFTE;
      if (l4FTESavings !== null) sumL2FTESavings += l4FTESavings;
    });

    // Automation Potential = Σ L2 FTE Savings ÷ Σ L2 Client FTE
    const automationPotential = (l1ClientFTE !== null && sumL2ClientFTE > 0)
      ? sumL2FTESavings / sumL2ClientFTE
      : null;

    const fteSavings = l1ClientFTE !== null ? sumL2FTESavings : null;

    return { step, clientFTE: l1ClientFTE, allocationPct, automationPotential, fteSavings };
  });

  const sorted = [...cards].sort((a, b) => (b.fteSavings ?? 0) - (a.fteSavings ?? 0));
  const rankIndex = new Map(sorted.map((c, i) => [c.step, i] as const));
  const shades = ['#0065BD', '#00338D', '#00A3E0', '#4D9EC8', '#6BBFDE', '#B3DFF2', '#D9F0FA'];
  const colorFor = (step: string) => shades[Math.min(rankIndex.get(step) ?? shades.length - 1, shades.length - 1)];

  return (
    <div className="border border-gray-200 rounded bg-white shadow-sm">
      <SectionHeader title={`${processId} Subprocess Summary`} />
      <div className="p-4">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(selectedSteps.length, 4)}, 1fr)` }}>
          {cards.map(c => (
            <div key={c.step} className="border border-gray-200 rounded overflow-hidden">
              <div className="px-3 py-2 text-white text-xs font-semibold" style={{ backgroundColor: colorFor(c.step) }}>
                {c.step}
              </div>
              <div className="p-3 text-xs">
                <div className="text-gray-500 mb-1">Net Savings Potential</div>
                <div className="text-[1.4rem] font-bold text-[#00338D] leading-none">
                  {c.fteSavings !== null ? '€ 0' : '—'}
                  {c.fteSavings !== null && <span className="text-xs font-medium text-gray-400 ml-1">EUR</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1">
          <span className="relative inline-flex items-center group">
            <Info size={13} className="text-gray-400 cursor-help" />
            <span className="pointer-events-none absolute left-0 bottom-full mb-2 z-30 hidden group-hover:block bg-white text-gray-700 text-[11px] leading-relaxed rounded-md px-3 py-3 w-72 whitespace-normal shadow-xl border border-gray-200">
              <span className="absolute -bottom-1.5 left-3 w-3 h-3 bg-white border-r border-b border-gray-200 rotate-45" />
              <span className="relative block">
                <span className="font-semibold text-[#00338D] block mb-1.5">FTE allocation across P2P subprocesses</span>
                {Object.entries(SUBPROCESS_FTE_ALLOCATION).map(([name, pct]) => {
                  const procFTEs = totalProcessFTEs;
                  const abs = procFTEs !== null ? ` (${(procFTEs * pct).toFixed(1)} FTEs)` : '';
                  return (
                    <span key={name} className="flex justify-between gap-2 py-0.5">
                      <span className="text-gray-600">{name}</span>
                      <span className="font-medium">{(pct * 100).toFixed(0)}%{abs}</span>
                    </span>
                  );
                })}
                <span className="block mt-2 text-gray-400 text-[10px] border-t border-gray-100 pt-1.5">
                  Automation Potential = Σ Level-2 FTE Savings ÷ Σ Level-2 Client FTE. Allocation based on KPMG benchmarking averages.
                </span>
              </span>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

// AI tool assignments and default automation potential per Level-2 subprocess
const AI_TOOL_ASSIGNMENTS: Record<string, { tools: { name: string; comingSoon?: boolean }[]; defaultPct: number }> = {
  'Validate, Approve, & Post Invoices / Credit Notes':                        { tools: [{ name: 'AI PIP' }],                                            defaultPct: 0.55 },
  'Create Requisition':                                                        { tools: [{ name: 'AI PR Creation' }, { name: 'Supplier MDM', comingSoon: true }], defaultPct: 0.70 },
  'Review & Approve Requisition (Incl. Budget Control)':                       { tools: [{ name: 'AI PR Creation' }],                                    defaultPct: 0.30 },
  'Modify or Cancel Requisition':                                              { tools: [{ name: 'AI PR Creation' }],                                    defaultPct: 0.10 },
  'Manage purchase order lifecycle':                                           { tools: [{ name: 'Supplier Communication Agent', comingSoon: true }],    defaultPct: 0.30 },
  'Accept/refuse & record receipt of goods/services':                          { tools: [{ name: 'AI Driven Goods Receipt Processing', comingSoon: true }], defaultPct: 0.40 },
  'Receive invoices & credit notes (incl. self billing & prepayments)':        { tools: [{ name: 'AI Contact Center', comingSoon: true }],               defaultPct: 0.20 },
};

// ERP case assignments per Level-2 subprocess (all coming soon)
const ERP_CASE_ASSIGNMENTS: Record<string, string[]> = {
  'Create purchase order (PO)':                       ['Guided Individual Procurement'],
  'Review, approve & distribute purchase':             ['Guided Individual Procurement'],
  'Validate, Approve, & Post Invoices / Credit Notes': ['3-Way-Match Optimization'],
  'Generate payments file & release payments':         ['Discount Usage / Cash Discount Optimization'],
};

// TOM case assignments per Level-2 subprocess
const TOM_CASE_ASSIGNMENTS: Record<string, string[]> = {
  'Modify or Cancel Requisition':                                          ['SCC'],
  'Create purchase order (PO)':                                            ['SCC'],
  'Review, approve & distribute purchase':                                 ['SCC'],
  'Manage purchase order lifecycle':                                       ['SCC'],
  'Modify or cancel purchase order':                                       ['SCC'],
  'Expedite Order':                                                        ['SCC'],
  'Receive advanced shipment notice (ASN)':                                ['SCC'],
  'Receive invoices & credit notes (incl. self billing & prepayments)':    ['SCC'],
  'Validate, Approve, & Post Invoices / Credit Notes':                     ['SCC'],
  'Generate payments file & release payments':                             ['SCC'],
  'Perform bank reconciliations':                                          ['SCC'],
};

// Level 3 sub-processes where "SCC" is listed as a TOM Case (drives the SCC scope selector)
export const SSC_INDIA_SUBPROCESSES: string[] = Object.entries(TOM_CASE_ASSIGNMENTS)
  .filter(([, cases]) => cases.includes('SCC'))
  .map(([name]) => name);

// Fixed FTE allocation percentages per Level-2 subprocess (l4), keyed by exact l4 string
// Sub-process-level allocation: % of the process-level FTEs allocated to each sub-process.
const L4_FTE_ALLOCATION: Record<string, number> = {
  // Requisitioning
  'Create Requisition':                                                    0.64,
  'Review & Approve Requisition (Incl. Budget Control)':                   0.19,
  'Modify or Cancel Requisition':                                          0.17,
  // Purchasing
  'Create purchase order (PO)':                                            0.29,
  'Review, approve & distribute purchase':                                 0.52,
  'Manage purchase order lifecycle':                                       0.05,
  'Modify or cancel purchase order':                                       0.09,
  'Expedite Order':                                                        0.05,
  // Receiving
  'Receive advanced shipment notice (ASN)':                                0.08,
  'Accept/refuse & record receipt of goods/services':                      0.81,
  'Research/resolve exceptions (disputes, warranty, return)':              0.11,
  // Invoice Processing & Payment
  'Receive invoices & credit notes (incl. self billing & prepayments)':    0.05,
  'Validate, Approve, & Post Invoices / Credit Notes':                     0.82,
  'Generate payments file & release payments':                             0.08,
  'Perform bank reconciliations':                                          0.05,
};

// ── NAICS Benchmarking Data ──────────────────────────────────────────────────

interface NaicsMetric {
  label: string;
  q25: number;
  q50: number;
  q75: number;
  isPercent?: boolean;
}

const NAICS_BENCHMARKING: Record<string, NaicsMetric[]> = {
  '3331': [
    { label: 'Personnel cost per FTE',                                                      q25: 11400,      q50: 51555.56,  q75: 67768.6   },
    { label: 'Days payable outstanding',                                                    q25: 25.75,      q50: 30,        q75: 45        },
    { label: 'Maverick buying (%)',                                                         q25: 0.38,       q50: 1,         q75: 2.25,     isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 11706.35,   q50: 23214.29,  q75: 41875     },
    { label: 'Purchase orders per FTE',                                                     q25: 8888.39,    q50: 15833.3,   q75: 25357.14  },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 7444.4,     q50: 10344.83,  q75: 12000     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 2.7,        q50: 4.02,      q75: 10.02     },
  ],
  '33411': [
    { label: 'Personnel cost per FTE',                                                      q25: 44400,      q50: 61578.9,   q75: 73000     },
    { label: 'Days payable outstanding',                                                    q25: 30,         q50: 40,        q75: 50        },
    { label: 'Maverick buying (%)',                                                         q25: 1,          q50: 2.8,       q75: 4,        isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 5013.18,    q50: 8361.2,    q75: 13399.98  },
    { label: 'Purchase orders per FTE',                                                     q25: 1000,       q50: 1562.5,    q75: 2520      },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 13291.67,   q50: 20375,     q75: 24000     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 3.33,       q50: 5.83,      q75: 7.75      },
  ],
  '424': [
    { label: 'Personnel cost per FTE',                                                      q25: 40311.56,   q50: 74745.93,  q75: 92210     },
    { label: 'Days payable outstanding',                                                    q25: 25,         q50: 40,        q75: 52        },
    { label: 'Maverick buying (%)',                                                         q25: 1,          q50: 2,         q75: 3.45,     isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 6611,       q50: 11425,     q75: 14503     },
    { label: 'Purchase orders per FTE',                                                     q25: 1183.1,     q50: 1828.9,    q75: 2830.3    },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 6744.9,     q50: 9547.6,    q75: 14750     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 2.43,       q50: 4.97,      q75: 10.09     },
  ],
  '2111': [
    { label: 'Personnel cost per FTE',                                                      q25: 97500,      q50: 130610.5,  q75: 144312.5  },
    { label: 'Days payable outstanding',                                                    q25: 21.5,       q50: 30,        q75: 43.5      },
    { label: 'Maverick buying (%)',                                                         q25: 0.85,       q50: 2,         q75: 5.75,     isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 1367.8,     q50: 4278.2,    q75: 6408.52   },
    { label: 'Purchase orders per FTE',                                                     q25: 716.56,     q50: 866.72,    q75: 1317.31   },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 3441.2,     q50: 9600,      q75: 17500     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 3,          q50: 4.03,      q75: 8.1       },
  ],
  '3113': [
    { label: 'Personnel cost per FTE',                                                      q25: 22250,      q50: 36400,     q75: 60254.6   },
    { label: 'Days payable outstanding',                                                    q25: 28,         q50: 40,        q75: 45        },
    { label: 'Maverick buying (%)',                                                         q25: 0,          q50: 1,         q75: 1.28,     isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 7500,       q50: 14285.71,  q75: 15673.9   },
    { label: 'Purchase orders per FTE',                                                     q25: 1079.3,     q50: 1520,      q75: 2750      },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 8928.5,     q50: 12500,     q75: 16125     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 6.2,        q50: 8.43,      q75: 12.59     },
  ],
  '33341': [
    { label: 'Personnel cost per FTE',                                                      q25: 44000,      q50: 58344.93,  q75: 72440     },
    { label: 'Days payable outstanding',                                                    q25: 27,         q50: 38,        q75: 43.75     },
    { label: 'Maverick buying (%)',                                                         q25: 0.5,        q50: 1.4,       q75: 3,        isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 4712.3,     q50: 11416.25,  q75: 17877.9   },
    { label: 'Purchase orders per FTE',                                                     q25: 666.67,     q50: 1428.5,    q75: 2409.1    },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 13333.33,   q50: 16666.6,   q75: 16904.7   },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 5.3,        q50: 7.95,      q75: 12.88     },
  ],
  '33361': [
    { label: 'Personnel cost per FTE',                                                      q25: 31714,      q50: 65260,     q75: 71540.5   },
    { label: 'Days payable outstanding',                                                    q25: 34.5,       q50: 47,        q75: 57.5      },
    { label: 'Maverick buying (%)',                                                         q25: 0.6,        q50: 1.75,      q75: 3.5,      isPercent: true },
    { label: 'Purchase requisition line items per FTE',                                     q25: 6048.39,    q50: 14445.3,   q75: 16025.3   },
    { label: 'Purchase orders per FTE',                                                     q25: 809.29,     q50: 1909.0,    q75: 3168.9    },
    { label: 'Invoices processed per FTE (AP)',                                             q25: 9250,       q50: 14875,     q75: 20789     },
    { label: 'FTEs performing AP process per $1B revenue',                                  q25: 4.23,       q50: 7.14,      q75: 11.07     },
  ],
};

function fmtNaicsValue(val: number, isPercent?: boolean): string {
  if (isPercent) return `${val}%`;
  return val.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

// ─────────────────────────────────────────────────────────────────────────────

function L3DeepDive({
  processId,
  selectedSteps,
  automationOverrides,
  setAutomationOverrides,
}: {
  processId: string;
  selectedSteps: string[];
  automationOverrides: Record<string, string>;
  setAutomationOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const { fteValues, savedCaseDrivers, l3FteOverrides, setL3FteOverride } = useApp();
  const proc = PROCESSES[processId];
  const [showValueDrivers, setShowValueDrivers] = useState(false);
  const [peeOverrides, setPeeOverrides] = useState<Record<string, string>>({});
  // Editable Client FTE — which row is currently being edited + its draft value.
  // The persisted override values live in global context (l3FteOverrides).
  const [editingFteKey, setEditingFteKey] = useState<string | null>(null);
  const [fteDraft, setFteDraft] = useState('');

  // Aggregate saved business-case value driver 5Y totals by driver name across all saved cases
  const savedDriverTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    Object.values(savedCaseDrivers).forEach(entry => {
      Object.entries(entry.drivers).forEach(([name, val]) => {
        totals[name] = (totals[name] || 0) + val;
      });
    });
    return totals;
  }, [savedCaseDrivers]);
  const savedCaseList = Object.values(savedCaseDrivers);
  const fmtDriver = (name: string) => {
    const v = savedDriverTotals[name];
    if (v === undefined || v === 0) return <span className="text-gray-300 font-normal">—</span>;
    return `€ ${Math.round(v).toLocaleString('de-DE')}`;
  };

  // Per-subprocess saved value driver values (keyed by normalized L4/subprocess name), summed across cases
  const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  // Fallback subprocess mapping for saved cases that predate per-subprocess attribution
  // (missing/empty bySubprocess): attribute the whole case's driver totals to a known default L3.
  const CASE_DEFAULT_SUBPROCESS: Record<string, string> = {
    'ai-pip': 'Validate, Approve, & Post Invoices / Credit Notes',
  };
  const savedBySubprocess = useMemo(() => {
    const m: Record<string, Record<string, number>> = {};
    Object.entries(savedCaseDrivers).forEach(([caseId, entry]) => {
      const bySub = entry.bySubprocess && Object.keys(entry.bySubprocess).length > 0
        ? entry.bySubprocess
        : (CASE_DEFAULT_SUBPROCESS[caseId]
            ? { [normKey(CASE_DEFAULT_SUBPROCESS[caseId])]: entry.drivers }
            : {});
      Object.entries(bySub).forEach(([sp, drv]) => {
        if (!m[sp]) m[sp] = {};
        Object.entries(drv).forEach(([name, val]) => { m[sp][name] = (m[sp][name] || 0) + val; });
      });
    });
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedCaseDrivers]);
  const savedCellVal = (rowNames: string[], driverName: string): number | null => {
    for (const n of rowNames) {
      const bucket = savedBySubprocess[normKey(n)];
      if (bucket && bucket[driverName] !== undefined && bucket[driverName] !== 0) return bucket[driverName];
    }
    return null;
  };
  const fmtCell = (v: number) => `€ ${Math.round(v).toLocaleString('de-DE')}`;

  if (!proc || selectedSteps.length === 0) return null;

  const totalProcessFTEs = parseFloat((fteValues[processId] || {})['fte'] || '') || null;

  return (
    <div className="border border-gray-200 rounded bg-white shadow-sm">
      <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
        <span>Level 3 Subprocess Summary</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowValueDrivers(v => !v)}
            className="flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded border transition-colors"
            style={{
              borderColor: showValueDrivers ? '#C8CEED' : 'rgba(255,255,255,0.35)',
              backgroundColor: showValueDrivers ? 'rgba(200,206,237,0.2)' : 'transparent',
              color: showValueDrivers ? '#C8CEED' : 'rgba(255,255,255,0.7)',
            }}
          >
            {showValueDrivers ? '▾' : '▸'} Value Driver Columns
          </button>
          <button className="text-xs text-blue-200 underline hover:text-white">Generate Client Summary</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-semibold w-36">Level 2 Sub-process</th>
              <th className="text-left px-3 py-2 font-semibold">Level 3 Sub-process</th>
              <th className="text-right px-3 py-2 font-semibold w-24">
                <span className="inline-flex items-center justify-end gap-1">
                  Client FTE
                  <span className="relative group">
                    <Info size={11} className="text-gray-400 cursor-help" />
                    <span className="pointer-events-none absolute right-0 top-full mt-2 z-30 hidden group-hover:block bg-white text-gray-700 text-[10px] leading-relaxed rounded-md px-3 py-2 w-64 whitespace-normal shadow-xl border border-gray-200 font-normal">
                      <span className="absolute -top-1.5 right-2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
                      <span className="relative">
                        FTE allocation is calculated based on previous projects and industry benchmarks.
                      </span>
                    </span>
                  </span>
                </span>
              </th>
              <th className="text-center px-3 py-2 font-semibold w-28">AI Case</th>
              <th className="text-center px-3 py-2 font-semibold w-24">ERP Case</th>
              <th className="text-center px-3 py-2 font-semibold w-24">TOM Case</th>
              {showValueDrivers && <>
                <th className="text-left px-3 py-2 font-semibold w-36 bg-[#EEF3FB] text-[#00338D] border-l border-[#C8CEED]">Automation-driven cost savings</th>
                <th className="text-left px-3 py-2 font-semibold w-24 bg-[#EEF3FB] text-[#00338D]">FTE Costs Savings</th>
                <th className="text-left px-3 py-2 font-semibold w-36 bg-[#EEF3FB] text-[#00338D]">Working Capital Optimization</th>
                <th className="text-left px-3 py-2 font-semibold w-28 bg-[#EEF3FB] text-[#00338D]">Carry-over Effect</th>
                <th className="text-left px-3 py-2 font-semibold w-32 bg-[#EEF3FB] text-[#00338D]">Material Cost Reduction</th>
                <th className="text-left px-3 py-2 font-semibold w-28 bg-[#EEF3FB] text-[#00338D] border-r border-[#C8CEED]">Profit Assurance</th>
              </>}
              <th className="text-right px-3 py-2 font-semibold w-32 text-[#00338D]">Net Savings Potential</th>
            </tr>
          </thead>
          <tbody>
            {selectedSteps.map(step => {
              const kpis = proc.l3KPIs[step] || [];
              const l1AllocationPct = SUBPROCESS_FTE_ALLOCATION[step] ?? null;
              const l1ClientFTE = (totalProcessFTEs !== null && l1AllocationPct !== null)
                ? totalProcessFTEs * l1AllocationPct
                : null;

              return kpis.map((kpi, idx) => {
                const l4Key = kpi.l4 ?? '';
                const l4AllocationPct = L4_FTE_ALLOCATION[l4Key] ?? null;
                const clientFTE = (l1ClientFTE !== null && l4AllocationPct !== null)
                  ? l1ClientFTE * l4AllocationPct
                  : null;

                const assignment = AI_TOOL_ASSIGNMENTS[l4Key] ?? null;
                const overrideStr = automationOverrides[l4Key];

                const aiTools  = assignment?.tools ?? [];
                const erpCases = ERP_CASE_ASSIGNMENTS[l4Key] ?? [];
                const tomCases = TOM_CASE_ASSIGNMENTS[l4Key] ?? [];

                // Saved business-case value driver values for this row (matched by subprocess name)
                const rowNames = [l4Key, step];
                const savedAuto = savedCellVal(rowNames, 'Automation-driven cost savings');
                const savedFte  = savedCellVal(rowNames, 'FTE Costs Savings');
                const savedWc   = savedCellVal(rowNames, 'Working Capital Optimization');
                const savedCo   = savedCellVal(rowNames, 'Carry-over Effect');
                const savedMat  = savedCellVal(rowNames, 'Material Cost Reduction');
                const savedPa   = savedCellVal(rowNames, 'Profit Assurance');

                // Display value for the editable input
                const inputDisplayValue = overrideStr !== undefined
                  ? overrideStr
                  : assignment
                    ? String(Math.round(assignment.defaultPct * 100))
                    : '';

                // Editable Client FTE — persisted override (global) wins over the calculated value.
                // Stable key so the value survives navigation, remounts and re-renders.
                const fteKey = `${processId}::${step}::${l4Key}`;
                const overrideFTE = l3FteOverrides[fteKey];
                const displayFTE = overrideFTE !== undefined
                  ? overrideFTE
                  : (clientFTE !== null ? clientFTE.toFixed(1) : null);
                const isEditingFte = editingFteKey === fteKey;

                const commitFte = () => {
                  const cleaned = fteDraft.trim().replace(',', '.');
                  if (cleaned !== '' && !Number.isNaN(Number(cleaned))) {
                    setL3FteOverride(fteKey, cleaned);
                  }
                  setEditingFteKey(null);
                };

                return (
                  <tr key={`${step}-${idx}`} className="border-b border-gray-100 hover:bg-gray-50">
                    {idx === 0 && (
                      <td className="px-3 py-1.5 font-semibold text-[#00338D] align-top" rowSpan={kpis.length}>
                        {step}
                      </td>
                    )}
                    <td className="px-3 py-1.5 text-gray-700">{kpi.l4 || <span className="text-gray-300">—</span>}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">
                      {isEditingFte ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          <input
                            autoFocus
                            type="text"
                            value={fteDraft}
                            onChange={e => setFteDraft(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitFte();
                              if (e.key === 'Escape') setEditingFteKey(null);
                            }}
                            className="w-16 border border-[#00A3E0] rounded px-1.5 py-0.5 text-xs text-right focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={commitFte}
                            className="text-[#00338D] hover:text-[#002C77]"
                            aria-label="Save"
                          >
                            <Check size={12} />
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex items-center justify-end gap-1 group">
                          {displayFTE !== null ? displayFTE : <span className="text-gray-300 font-normal">—</span>}
                          <button
                            type="button"
                            onClick={() => { setEditingFteKey(fteKey); setFteDraft(displayFTE ?? ''); }}
                            className="text-gray-300 hover:text-[#00338D] group-hover:text-gray-400"
                            aria-label="Edit Client FTE"
                          >
                            <Pencil size={11} />
                          </button>
                        </span>
                      )}
                    </td>
                    {/* AI Case */}
                    <td className="px-3 py-1.5 text-center">
                      {aiTools.length > 0 ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          {aiTools.map(t => (
                            <span key={t.name} className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${t.comingSoon ? 'bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-300' : 'bg-[#00338D]/10 text-[#00338D]'}`}>
                              {t.name}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* ERP Case */}
                    <td className="px-3 py-1.5 text-center">
                      {erpCases.length > 0 ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          {erpCases.map(c => (
                            <span key={c} className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-gray-100 text-gray-400 ring-1 ring-inset ring-gray-300">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* TOM Case */}
                    <td className="px-3 py-1.5 text-center">
                      {tomCases.length > 0 ? (
                        <div className="flex flex-col gap-0.5 items-center">
                          {tomCases.map(c => (
                            <span key={c} className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-[#FD349C]/10 text-[#FD349C]">
                              {c}
                            </span>
                          ))}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    {/* Toggleable value driver columns */}
                    {showValueDrivers && <>
                      {/* Automation-driven cost savings — only shown for saved cases */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE] border-l border-[#C8CEED]">
                        {savedAuto !== null ? fmtCell(savedAuto) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      {/* FTE Costs Savings */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE]">
                        {savedFte !== null ? fmtCell(savedFte) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      {/* Working Capital Optimization */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE]">
                        {savedWc !== null ? fmtCell(savedWc) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      {/* Carry-over Effect */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE]">
                        {savedCo !== null ? fmtCell(savedCo) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      {/* Material Cost Reduction */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE]">
                        {savedMat !== null ? fmtCell(savedMat) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                      {/* Profit Assurance */}
                      <td className="px-3 py-1.5 text-right font-bold text-[#00338D] bg-[#F8FAFE] border-r border-[#C8CEED]">
                        {savedPa !== null ? fmtCell(savedPa) : <span className="text-gray-300 font-normal">—</span>}
                      </td>
                    </>}
                    {/* Net Savings Potential — sum of all Value Driver columns for this row */}
                    {(() => {
                      const rowNetSavings =
                        (savedAuto ?? 0) + (savedFte ?? 0) + (savedWc ?? 0) +
                        (savedCo ?? 0) + (savedMat ?? 0) + (savedPa ?? 0);
                      return (
                        <td className="px-3 py-1.5 text-right font-bold text-[#00338D]">
                          {rowNetSavings !== 0
                            ? fmtCell(rowNetSavings)
                            : <span className="text-gray-300 font-normal">—</span>}
                        </td>
                      );
                    })()}
                  </tr>
                );
              });
            })}
          </tbody>
          {showValueDrivers && savedCaseList.length > 0 && (
            <tfoot>
              <tr className="bg-[#EEF3FB] border-t-2 border-[#00338D]">
                <td className="px-3 py-2 font-bold text-[#00338D]" colSpan={3}>
                  Saved Business Case Value (5Y)
                </td>
                <td className="px-3 py-2 text-[10px] text-[#00338D]/70 font-normal" colSpan={3}>
                  {savedCaseList.map(c => c.title).join(', ')}
                </td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D] border-l border-[#C8CEED]">{fmtDriver('Automation-driven cost savings')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D]">{fmtDriver('FTE Costs Savings')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D]">{fmtDriver('Working Capital Optimization')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D]">{fmtDriver('Carry-over Effect')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D]">{fmtDriver('Material Cost Reduction')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D] border-r border-[#C8CEED]">{fmtDriver('Profit Assurance')}</td>
                <td className="px-3 py-2 text-right font-bold text-[#00338D]">
                  € {Math.round(Object.values(savedDriverTotals).reduce((s, v) => s + v, 0)).toLocaleString('de-DE')}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="px-4 py-2 text-xs text-gray-400 italic border-t border-gray-100">
        Client FTE = Level 2 Client FTE × FTE Allocation %. FTE Savings = (1 − Proven AI Potential) × Client FTE.
      </div>
    </div>
  );
}

function ProcessBenchmarking({ processId }: { processId: string }) {
  const { l3SelectedSteps, toggleL3Step, setL3Steps, clientData } = useApp();
  const naicsCode = clientData.subIndustry;

  const [automationOverrides, setAutomationOverrides] = useState<Record<string, string>>({});
  const [clientBaseline, setClientBaseline] = useState<'Q25' | 'Q50' | 'Q75'>('Q50');

  const proc = PROCESSES[processId];
  const disabled = new Set((proc?.disabledSteps) || []);
  const allEnabledSteps = proc ? proc.steps.filter(s => !disabled.has(s)) : [];

  useEffect(() => {
    if (!proc) return;
    if (!l3SelectedSteps[processId]) {
      setL3Steps(processId, allEnabledSteps);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processId]);

  if (!proc) return null;

  const rawSelected = l3SelectedSteps[processId] ?? allEnabledSteps;
  const selectedL3 = proc.steps.filter(s => rawSelected.includes(s) && !disabled.has(s));
  const allVisible = selectedL3.length === allEnabledSteps.length;

  const naicsMetrics = naicsCode ? NAICS_BENCHMARKING[naicsCode] : null;
  const getVal = (m: NaicsMetric) => {
    const raw = clientBaseline === 'Q25' ? m.q25 : clientBaseline === 'Q50' ? m.q50 : m.q75;
    return fmtNaicsValue(raw, m.isPercent);
  };

  return (
    <div className="space-y-4">

      {/* Sub-process Summary + Deep Dive (conditional) */}
      {selectedL3.length > 0 && (
        <>
          <L3SummaryCards processId={processId} selectedSteps={selectedL3} automationOverrides={automationOverrides} />
          <L3DeepDive
            processId={processId}
            selectedSteps={selectedL3}
            automationOverrides={automationOverrides}
            setAutomationOverrides={setAutomationOverrides}
          />
        </>
      )}

      {/* NAICS Benchmarking Table */}
      <div className="border border-gray-200 rounded bg-white shadow-sm">
        <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
          <span>Benchmarking{naicsCode ? ` — NAICS ${naicsCode}` : ''}</span>
          <div className="flex items-center gap-2">
            <span className="text-white/70 text-[10px]">Client Baseline</span>
            <select
              value={clientBaseline}
              onChange={e => setClientBaseline(e.target.value as 'Q25' | 'Q50' | 'Q75')}
              className="text-[10px] font-semibold bg-white/15 text-white border border-white/30 rounded px-2 py-0.5 focus:outline-none"
            >
              <option value="Q25">25th Percentile (Q25)</option>
              <option value="Q50">50th Percentile (Q50)</option>
              <option value="Q75">75th Percentile (Q75)</option>
            </select>
          </div>
        </div>

        {!naicsCode ? (
          <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
            Select a Sub Industry on the Home page to view benchmarking data.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200">
                <th className="text-left px-4 py-2 font-semibold text-gray-600">Metric</th>
                <th className={`text-right px-4 py-2 font-semibold w-28 ${clientBaseline === 'Q25' ? 'bg-amber-50 text-amber-700' : 'text-gray-600'}`}>Q25</th>
                <th className={`text-right px-4 py-2 font-semibold w-28 ${clientBaseline === 'Q50' ? 'bg-blue-50 text-[#00338D]' : 'text-gray-600'}`}>Q50</th>
                <th className={`text-right px-4 py-2 font-semibold w-28 ${clientBaseline === 'Q75' ? 'bg-green-50 text-green-700' : 'text-gray-600'}`}>Q75</th>
                <th className={`text-right px-4 py-2 font-semibold w-36 ${
                  clientBaseline === 'Q25' ? 'bg-amber-50 text-amber-700' :
                  clientBaseline === 'Q50' ? 'bg-blue-50 text-[#00338D]' :
                  'bg-green-50 text-green-700'
                }`}>
                  Selected ({clientBaseline})
                </th>
              </tr>
            </thead>
            <tbody>
              {naicsMetrics!.map((m, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{m.label}</td>
                  <td className={`px-4 py-2 text-right ${clientBaseline === 'Q25' ? 'font-semibold text-amber-700 bg-amber-50' : 'text-gray-500'}`}>
                    {fmtNaicsValue(m.q25, m.isPercent)}
                  </td>
                  <td className={`px-4 py-2 text-right ${clientBaseline === 'Q50' ? 'font-semibold text-[#00338D] bg-blue-50' : 'text-gray-500'}`}>
                    {fmtNaicsValue(m.q50, m.isPercent)}
                  </td>
                  <td className={`px-4 py-2 text-right ${clientBaseline === 'Q75' ? 'font-semibold text-green-700 bg-green-50' : 'text-gray-500'}`}>
                    {fmtNaicsValue(m.q75, m.isPercent)}
                  </td>
                  <td className={`px-4 py-2 text-right font-bold text-sm ${
                    clientBaseline === 'Q25' ? 'text-amber-700 bg-amber-50' :
                    clientBaseline === 'Q50' ? 'text-[#00338D] bg-blue-50' :
                    'text-green-700 bg-green-50'
                  }`}>
                    {getVal(m)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function Benchmarking() {
  const { selectedProcesses } = useApp();
  const [activeTab, setActiveTab] = useState<string>('');

  const currentTab = activeTab || selectedProcesses[0] || '';

  if (selectedProcesses.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500 text-sm">
        Please select at least one process under{' '}
        <strong>Home → Which processes would you like to optimize?</strong>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Process tabs */}
      <div className="sticky top-0 z-20 bg-gray-100 pt-4 -mx-4 px-4 pb-2">
        <div className="flex gap-0 border-b border-gray-300 -mb-px">
          {selectedProcesses.map(procId => {
            const proc = PROCESSES[procId];
            if (!proc) return null;
            const isActive = currentTab === procId;
            return (
              <button
                key={procId}
                onClick={() => setActiveTab(procId)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive
                    ? 'border-[#00338D] text-[#00338D] bg-white font-semibold'
                    : 'border-transparent text-gray-500 hover:text-gray-700 bg-transparent'
                }`}
              >
                {proc.tabLabel}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Process Content */}
      {currentTab && <ProcessBenchmarking processId={currentTab} />}
    </div>
  );
}