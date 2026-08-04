import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, BookmarkCheck, Check, Package, Code2 } from 'lucide-react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell,
} from 'recharts';
import { useApp, CustomUseCaseDef } from '../context/AppContext';
import { CustomFieldDef, FormulaToken, evalFormula, formulaToString } from '../utils/formula';

const DISCOUNT = 0.10;
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function parseNum(s: string): number {
  const n = parseFloat((s || '').replace(/\s/g, '').replace(/,/g, '.'));
  return isNaN(n) ? 0 : n;
}

const fmtKpi = (n: number) => {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}k`;
  return `${sign}€${Math.round(abs)}`;
};
const fmtEur = (v: number) => {
  if (v === 0) return '—';
  const abs = Math.abs(v), sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}€${(abs / 1_000).toFixed(0)}k`;
  return `${sign}€${abs.toFixed(0)}`;
};

export function CustomUseCasePage({ def, onEnterDeveloperMode }: {
  def: CustomUseCaseDef;
  onEnterDeveloperMode: () => void;
}) {
  const { saveCaseDrivers } = useApp();
  const readOnly = def.mode === 'view';

  const [showSubProc, setShowSubProc] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [rampPcts, setRampPcts] = useState<number[]>([0, 70, 90, 100, 100, 100]);

  // Field values keyed by field id
  const [values, setValues] = useState<Record<string, string>>({});
  const setVal = (id: string, v: string) => setValues(prev => ({ ...prev, [id]: v }));

  const numericValues = useMemo(() => {
    const map: Record<string, number> = {};
    [...def.baselineFields, ...def.feeFields].forEach(f => {
      const raw = parseNum(values[f.id] ?? '');
      map[f.id] = f.unit === 'percent' ? raw / 100 : raw;
    });
    return map;
  }, [values, def.baselineFields, def.feeFields]);

  const oneTimeCost = useMemo(() => evalFormula(def.formulas.oneTime, numericValues), [def.formulas.oneTime, numericValues]);
  const recurringCost = useMemo(() => evalFormula(def.formulas.recurring, numericValues), [def.formulas.recurring, numericValues]);
  const benefitsPerYear = useMemo(() => evalFormula(def.formulas.benefits, numericValues), [def.formulas.benefits, numericValues]);

  // ── Annual model (Year 0–5), mirroring the AIPIP business case model ──
  const model = useMemo(() => {
    let cumNet = 0, cumNpv = 0;
    return ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'].map((yr, i) => {
      const ramp = (rampPcts[i] ?? 100) / 100;
      const totalBenefits = i === 0 ? 0 : benefitsPerYear;
      const benefits = totalBenefits * ramp;
      const oneTime = i === 0 ? oneTimeCost : 0;
      const running = i === 0 ? 0 : recurringCost;
      const netBenefits = benefits - oneTime - running;
      const npv = netBenefits / Math.pow(1 + DISCOUNT, i);
      cumNet += netBenefits;
      cumNpv += npv;
      return { yr, totalBenefits, benefits, rampPct: rampPcts[i] ?? 100, oneTime, running, netBenefits, cumNet, npv, cumNpv };
    });
  }, [rampPcts, oneTimeCost, recurringCost, benefitsPerYear]);

  const summary = useMemo(() => {
    const totalBenefits5Y = model.reduce((s, d) => s + d.benefits, 0);
    const runningCost5Y = model.reduce((s, d) => s + d.running, 0);
    const totalCost5Y = oneTimeCost + runningCost5Y;
    const roi = totalCost5Y > 0 ? totalBenefits5Y / totalCost5Y : null;
    const finalCumNet = model[model.length - 1]?.cumNet ?? 0;
    const finalCumNpv = model[model.length - 1]?.cumNpv ?? 0;
    const netSavingsY4 = model[4]?.netBenefits ?? 0;

    // Break-even in months (first year cumulative net turns positive, interpolated)
    let breakEvenMonths = 999;
    for (let i = 1; i < model.length; i++) {
      const prev = model[i - 1].cumNet, cur = model[i].cumNet;
      if (prev < 0 && cur >= 0 && model[i].netBenefits > 0) {
        breakEvenMonths = Math.round((i - 1) * 12 + (-prev / model[i].netBenefits) * 12);
        break;
      }
    }
    if (breakEvenMonths === 999 && finalCumNet >= 0) breakEvenMonths = 0;

    return { totalBenefits5Y, runningCost5Y, totalCost5Y, roi, finalCumNet, finalCumNpv, netSavingsY4, breakEvenMonths };
  }, [model, oneTimeCost]);

  const benefits5Y = summary.totalBenefits5Y;

  // Value driver breakdown: split 5Y benefits evenly across selected drivers
  const driverBreakdown = useMemo(() => {
    const out: Record<string, number> = {};
    if (def.valueDrivers.length > 0) {
      const share = benefits5Y / def.valueDrivers.length;
      def.valueDrivers.forEach(d => { out[d] = share; });
    }
    return out;
  }, [def.valueDrivers, benefits5Y]);

  const handleSave = () => {
    const bySubprocess: Record<string, Record<string, number>> = {};
    if (def.subProcesses.length > 0) {
      const share = 1 / def.subProcesses.length;
      def.subProcesses.forEach(sp => {
        bySubprocess[normKey(sp)] = Object.fromEntries(
          Object.entries(driverBreakdown).map(([k, v]) => [k, v * share]),
        );
      });
    }
    saveCaseDrivers(def.id, def.name, driverBreakdown, bySubprocess);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  };

  const inputCls = (ro: boolean) => ro
    ? 'w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs text-gray-700 h-8 cursor-default'
    : 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#00338D] h-8';

  const renderFields = (fields: CustomFieldDef[], ro: boolean) => (
    <div className="grid grid-cols-3 gap-3">
      {fields.length === 0 && <p className="col-span-3 text-xs text-gray-400 italic">No fields defined.</p>}
      {fields.map(f => (
        <div key={f.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-gray-600">
            {f.name} {f.unit === 'currency' ? '(€)' : f.unit === 'percent' ? '(%)' : ''}
          </label>
          <input
            type="text" readOnly={ro} value={values[f.id] ?? ''}
            onChange={e => setVal(f.id, e.target.value)}
            placeholder={ro ? '—' : '0'}
            className={inputCls(ro)}
          />
        </div>
      ))}
    </div>
  );

  // Baseline/fee VALUES stay editable in both modes so the case is fully functional;
  // Developer Mode (the wizard) is what changes the case's structure & formulas.
  const ro = false;

  // Chart data
  const chartData = model.map(d => ({
    year: d.yr,
    'Non-recurring': -d.oneTime,
    'Recurring': -d.running,
    'Benefits': d.benefits,
    'Net Savings': d.netBenefits,
    'Cumulative Savings': d.cumNet,
  }));

  const bem = summary.breakEvenMonths;

  return (
    <div className="bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white border border-gray-200 rounded shadow-sm p-4 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded flex items-center justify-center" style={{ backgroundColor: '#00338D' }}>
              <Package size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#00338D]">{def.name}</h2>
              <p className="text-xs text-gray-500 mt-0.5 max-w-xl">{def.description || 'Custom use case'}</p>
              <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-[#00338D]">
                {def.mode === 'developer' ? 'Developer Mode' : 'View Mode'}
              </span>
            </div>
          </div>
          <button
            onClick={onEnterDeveloperMode}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-3 py-2 rounded"
            style={{ backgroundColor: '#00338D' }}
          >
            <Code2 size={14} /> {readOnly ? 'Return to Developer Mode' : 'Edit in Developer Mode'}
          </button>
        </div>

        {/* Use Case Summary */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold flex items-center justify-between">
            <span>Use Case Summary</span>
            <button onClick={handleSave} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded bg-white text-[#00338D]">
              {savedFlash ? <><Check size={10} /> Saved!</> : <><BookmarkCheck size={10} /> Save Case</>}
            </button>
          </div>
          <div className="p-4 grid grid-cols-6 gap-3 text-center">
            <SummaryCard label="ROI (5Y)" value={summary.roi !== null ? `${(summary.roi * 100).toFixed(0)}%` : 'N/A'} />
            <SummaryCard
              label="Break-even"
              value={bem > 66 ? '> 66m' : `${bem}m`}
              color={bem <= 18 ? 'text-green-600' : bem <= 30 ? 'text-orange-500' : bem <= 66 ? 'text-red-600' : 'text-gray-400'}
            />
            <SummaryCard label="Net Savings / Year" value={fmtKpi(summary.netSavingsY4)} sub="Year 4" negative={summary.netSavingsY4 < 0} />
            <SummaryCard label="FTE Reduction" value="—" />
            <SummaryCard label="Net Efficiency Gains" value="—" />
            <SummaryCard label="One-Time Cost" value={fmtKpi(oneTimeCost)} />
          </div>
        </div>

        {/* Business Case Annual View */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold">Business Case — Annual View</div>
          <div className="p-4">
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `€${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtEur(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine key="ref-zero" y={0} stroke="#999" />
                  <Bar key="bar-nonrecurring" dataKey="Non-recurring" fill="#1A2B60" barSize={18} />
                  <Bar key="bar-recurring" dataKey="Recurring" fill="#FD349C" barSize={18} />
                  <Bar key="bar-benefits" dataKey="Benefits" fill="#00A3E0" barSize={18} />
                  <Bar key="bar-netsavings" dataKey="Net Savings" barSize={18}>
                    {chartData.map((entry, i) => (
                      <Cell key={`cell-${i}`} fill={entry['Net Savings'] < 0 ? '#ef4444' : '#22c55e'} />
                    ))}
                  </Bar>
                  <Line
                    key="line-cumulative"
                    type="monotone" dataKey="Cumulative Savings" stroke="#f97316" strokeWidth={3}
                    strokeDasharray="5 5" dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: '#fff' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Toggle */}
            <div className="flex justify-end mt-2">
              <button
                onClick={() => setShowTable(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                {showTable ? 'Hide Calculation Table' : 'Show Calculation Table'}
              </button>
            </div>

            {/* Collapsible calculation table */}
            {showTable && (
              <div className="border-t border-gray-200 mt-3 pt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2 font-medium">€ per year</th>
                      {model.map(d => <th key={d.yr} className="text-right px-3 py-2 font-medium">{d.yr}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {CALC_ROWS.map(row => (
                      <tr key={row.label} className={`border-b border-gray-100 ${row.bold ? 'bg-gray-50/60' : ''} ${row.isRamp ? 'bg-blue-50/40' : ''}`}>
                        <td className={`px-3 py-1.5 ${row.bold ? 'font-semibold text-gray-800' : row.isRamp ? 'text-gray-500 italic' : 'text-gray-700'}`}>{row.label}</td>
                        {model.map((d, i) => {
                          if (row.isRamp) {
                            return (
                              <td key={i} className="px-3 py-1.5 text-right">
                                {i === 0 ? <span className="text-gray-300 italic">—</span> : (
                                  <div className="inline-flex items-center justify-end gap-0.5">
                                    <input
                                      type="number" min={0} max={100} value={rampPcts[i]}
                                      onChange={e => setRampPcts(prev => { const next = [...prev]; next[i] = Number(e.target.value); return next; })}
                                      className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:border-[#00338D]"
                                    />
                                    <span className="text-gray-400 text-xs">%</span>
                                  </div>
                                )}
                              </td>
                            );
                          }
                          const v = row.get(d);
                          if (i === 0 && (row.label === 'Total Benefits' || row.label === 'Process Efficiency Enhancement')) {
                            return <td key={i} className="px-3 py-1.5 text-right text-gray-300">—</td>;
                          }
                          const color = row.invest ? 'text-red-600' : row.accent ? 'text-[#00338D]' : v < 0 ? 'text-red-600' : 'text-gray-700';
                          return <td key={i} className={`px-3 py-1.5 text-right ${row.bold ? 'font-semibold' : ''} ${color}`}>{fmtEur(v)}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[10px] text-gray-400 mt-2">Discount rate: 10% · One-Time Cost in Year 0 · editable ramp-up</div>
              </div>
            )}
          </div>
        </div>

        {/* Baselining */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold">Client Baselining</div>
          <div className="p-4 space-y-4">
            {/* Applied Sub-Processes (collapsible) */}
            <div className="border border-gray-200 rounded overflow-hidden">
              <button
                type="button" onClick={() => setShowSubProc(p => !p)}
                className="w-full bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-[#00338D] border-b border-gray-200 flex items-center justify-between hover:bg-gray-100"
              >
                <span className="flex items-center gap-1.5">
                  {showSubProc ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Applied Sub-Processes
                </span>
                <span className="text-[10px] font-normal text-gray-500">{def.subProcesses.length} selected</span>
              </button>
              {showSubProc && (
                <div className="p-3 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {def.subProcesses.length === 0 && <p className="text-xs text-gray-400">No sub-processes assigned.</p>}
                  {def.subProcesses.map(sp => (
                    <div key={sp} className="flex items-start gap-2 text-xs text-gray-700">
                      <Check size={13} className="mt-0.5 text-[#00338D]" /> <span>{sp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-200 rounded overflow-hidden">
              <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-[#00338D] border-b border-gray-200">Baselining Fields</div>
              <div className="p-3">{renderFields(def.baselineFields, ro)}</div>
            </div>
          </div>
        </div>

        {/* Fees */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold">Fees</div>
          <div className="p-4">{renderFields(def.feeFields, ro)}</div>
        </div>

        {/* Calculation logic (formulas) */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold">Calculation Logic</div>
          <div className="p-4 space-y-2 text-xs">
            <FormulaRow label="One-Time Costs" tokens={def.formulas.oneTime} result={oneTimeCost} />
            <FormulaRow label="Recurring Costs" tokens={def.formulas.recurring} result={recurringCost} />
            <FormulaRow label="Benefits" tokens={def.formulas.benefits} result={benefitsPerYear} />
          </div>
        </div>

        {/* Value Driver Breakdown */}
        <div className="bg-white border border-gray-200 rounded shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-2 text-xs font-semibold">Value Driver Breakdown (5Y)</div>
          <div className="p-4">
            {def.valueDrivers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No value drivers selected.</p>
            ) : (
              <table className="w-full text-xs">
                <tbody>
                  {def.valueDrivers.map(d => (
                    <tr key={d} className="border-b border-gray-100">
                      <td className="px-3 py-2 text-gray-700">{d}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#00338D]">{fmtEur(driverBreakdown[d] ?? 0)}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 font-semibold text-gray-700">Total Benefits (5Y)</td>
                    <td className="px-3 py-2 text-right font-bold text-[#00338D]">{fmtEur(benefits5Y)}</td>
                  </tr>
                </tbody>
              </table>
            )}
            <p className="text-[10px] text-gray-400 mt-2">
              Saved cases populate the Deep Dive value-driver columns for their assigned Level 3 sub-processes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type ModelRow = {
  totalBenefits: number; benefits: number; rampPct: number; oneTime: number;
  running: number; netBenefits: number; cumNet: number; npv: number; cumNpv: number;
};

const CALC_ROWS: Array<{
  label: string; get: (d: ModelRow) => number;
  bold?: boolean; isRamp?: boolean; invest?: boolean; accent?: boolean;
}> = [
  { label: 'Process Efficiency Enhancement', get: d => d.benefits },
  { label: 'Total Benefits', get: d => d.benefits },
  { label: 'Ramp-up (%)', get: d => d.rampPct, isRamp: true },
  { label: 'One-Time Cost', get: d => -d.oneTime, invest: true },
  { label: 'Running Cost', get: d => -d.running, invest: true },
  { label: 'Net Benefits', get: d => d.netBenefits, bold: true },
  { label: 'Cum. Net Benefits', get: d => d.cumNet },
  { label: 'Net Present Value (NPV)', get: d => d.npv },
  { label: 'Cum. NPV', get: d => d.cumNpv, bold: true, accent: true },
];

function SummaryCard({ label, value, sub, color, negative }: {
  label: string; value: string; sub?: string; color?: string; negative?: boolean;
}) {
  return (
    <div className="border border-gray-200 rounded bg-gray-50 p-3">
      <div className="text-xs text-gray-600 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color ?? (negative ? 'text-red-600' : 'text-[#00338D]')}`}>{value}</div>
      {sub && <div className="text-[8px] text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function FormulaRow({ label, tokens, result }: { label: string; tokens: FormulaToken[]; result: number }) {
  return (
    <div className="flex items-center justify-between border border-gray-100 rounded px-3 py-2">
      <div>
        <span className="font-semibold text-gray-700">{label}</span>
        <span className="text-gray-400"> = {formulaToString(tokens)}</span>
      </div>
      <span className="font-semibold text-[#00338D]">{fmtEur(result)}</span>
    </div>
  );
}
