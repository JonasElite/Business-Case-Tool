import { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Save, Pencil, Check, RotateCcw } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { HomeSnapshot } from '../context/AppContext';
import { formatThousands } from '../utils/formatNumber';

const STORAGE_KEY = 'aibct_home_snapshot';

const PROCESS_OPTIONS = [
  { id: 'P2P', label: 'Procurement-to-Pay (P2P)' },
  { id: 'O2C', label: 'Order to Cash (O2C)' },
  { id: 'R2R', label: 'Record to Report (R2R)' },
];

function readStoredSnapshot(): HomeSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HomeSnapshot;
  } catch {
    return null;
  }
}

function SectionHeader({ title, step, done }: { title: string; step: number; done?: boolean }) {
  return (
    <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center gap-2">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] shrink-0 ${done ? 'bg-green-400' : 'bg-white/20'}`}>
        {done ? <Check size={9} /> : step}
      </span>
      {title}
    </div>
  );
}

const CLIENT_OPTIONS = ['MOL', 'Salzgitter', 'Siemens Energy', 'Dalli Group', 'Nordea'];

// Auto-populated client profile presets, keyed by client name
const CLIENT_PRESETS: Record<string, {
  industry: string; subIndustry: string; country: string; revenue: string; employees: string;
}> = {
  'Siemens Energy': {
    industry: 'Energy',
    subIndustry: '33361',
    country: 'Germany',
    revenue: '39.100.000.000',
    employees: '101.000',
  },
};

function InputField({
  label, value, onChange, placeholder = 'Enter here', required, readOnly, options,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; required?: boolean; readOnly?: boolean; options?: string[];
}) {
  const [open, setOpen] = useState(false);
  const filtered = options?.filter(o => o.toLowerCase().includes(value.toLowerCase())) ?? [];

  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </div>
      {options && !readOnly ? (
        <div className="relative">
          <input
            value={value}
            onChange={e => { onChange?.(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none h-[30px] focus:border-[#00A3E0] pr-7"
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-[10px]">▾</span>
          {open && filtered.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-white border border-gray-200 rounded shadow-lg max-h-48 overflow-auto">
              {filtered.map(opt => (
                <li
                  key={opt}
                  onMouseDown={() => { onChange?.(opt); setOpen(false); }}
                  className={`px-3 py-1.5 text-xs cursor-pointer hover:bg-[#EEF3FB] hover:text-[#00338D] ${value === opt ? 'bg-[#EEF3FB] text-[#00338D] font-semibold' : 'text-gray-700'}`}
                >
                  {opt}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full border rounded px-3 py-2 text-xs focus:outline-none h-[30px] ${
            readOnly
              ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
              : 'border-gray-300 focus:border-[#00A3E0]'
          }`}
        />
      )}
    </div>
  );
}

// Benchmark: FTEs performing AP process per $1B revenue, by NAICS code
const AP_FTE_BENCHMARK: Record<string, { Q25: number; Q50: number; Q75: number }> = {
  '3331':  { Q25: 2.89, Q50: 4.02, Q75: 5.48 },
  '33411': { Q25: 4.19, Q50: 5.83, Q75: 7.95 },
  '424':   { Q25: 3.57, Q50: 4.97, Q75: 6.78 },
  '2111':  { Q25: 2.90, Q50: 4.03, Q75: 5.50 },
  '3113':  { Q25: 6.06, Q50: 8.43, Q75: 11.50 },
  '33341': { Q25: 5.71, Q50: 7.95, Q75: 10.84 },
  '33361': { Q25: 4.23, Q50: 7.14, Q75: 11.07 },
};

function parseRevenue(raw: string): number {
  // Strip all non-digit characters (handles both 500,000,000 and 500.000.000)
  return parseInt(raw.replace(/\D/g, ''), 10) || 0;
}

export function Home({ onAfterSave }: { onAfterSave?: () => void } = {}) {
  const {
    selectedProcesses, toggleProcess,
    clientData, updateClientData,
    fteValues, setFteValue,
    selectedUseCases,
    restoreSnapshot, resetAll,
    naicsCode, setNaicsCode,
  } = useApp();

  // UI state — initialised from localStorage synchronously so there's no flash
  const stored = readStoredSnapshot();
  const [showProcessScope, setShowProcessScope] = useState(() => stored?.showProcessScope ?? false);
  const [showUseCaseScope, setShowUseCaseScope] = useState(() => stored?.showUseCaseScope ?? false);
  const [savedSnapshot, setSavedSnapshot] = useState<HomeSnapshot | null>(() => stored);
  const [isEditing, setIsEditing] = useState(() => stored === null);
  const [saveFlash, setSaveFlash] = useState(false);
  const [p2pBenchmarkOn, setP2pBenchmarkOn] = useState(false);
  const [p2pBenchmarkQuartile, setP2pBenchmarkQuartile] = useState<'Q25' | 'Q50' | 'Q75'>('Q50');

  // Auto-calculate P2P FTEs from selected benchmark quartile × revenue × 1.14
  const computedP2pFte = useMemo(() => {
    const row = AP_FTE_BENCHMARK[clientData.subIndustry];
    const revenue = parseRevenue(clientData.revenue);
    if (!row || !revenue) return null;
    return row[p2pBenchmarkQuartile] * (revenue / 1_000_000_000) * 1.14;
  }, [clientData.subIndustry, clientData.revenue, p2pBenchmarkQuartile]);

  useEffect(() => {
    if (p2pBenchmarkOn && computedP2pFte !== null) {
      setFteValue('P2P', 'fte', computedP2pFte.toFixed(1));
    }
  }, [p2pBenchmarkOn, computedP2pFte]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore context state from localStorage once on mount
  useEffect(() => {
    const snap = readStoredSnapshot();
    if (snap) restoreSnapshot(snap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileNext = () => {
    setShowProcessScope(true);
  };

  const handleRestart = () => {
    resetAll();
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    setShowProcessScope(false);
    setShowUseCaseScope(false);
    setSavedSnapshot(null);
    setIsEditing(true);
  };

  const handleSave = () => {
    const snapshot: HomeSnapshot = {
      clientData: { ...clientData },
      selectedProcesses: [...selectedProcesses],
      fteValues: JSON.parse(JSON.stringify(fteValues)),
      selectedUseCases: [...selectedUseCases],
      showProcessScope,
      showUseCaseScope,
      savedAt: new Date().toLocaleString('de-DE'),
    };
    setSavedSnapshot(snapshot);
    setIsEditing(false);
    setSaveFlash(true);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch (_) {}
    setTimeout(() => {
      setSaveFlash(false);
      onAfterSave?.();
    }, 600);
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const locked = !isEditing;

  return (
    <div className="space-y-4 max-w-full pt-4">

      {/* Page header with Restart */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#00338D]">Project Setup</h2>
        <button
          type="button"
          onClick={handleRestart}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          <RotateCcw size={12} />
          Restart
        </button>
      </div>

      {/* ── Step 1: Client Profile Setup ────────────────────────── */}
      <div className="border border-gray-200 rounded bg-white shadow-sm">
        <SectionHeader title="Client Profile Setup" step={1} done={showProcessScope} />
        <div className="p-5 space-y-0">
          <div className="grid grid-cols-3 gap-x-5 gap-y-4">
            <InputField
              label="Client name"
              value={clientData.client}
              onChange={v => {
                const preset = CLIENT_PRESETS[v];
                if (preset) {
                  // Exact match on a client with a preset → auto-populate
                  updateClientData({ client: v, ...preset });
                } else if (CLIENT_OPTIONS.includes(v)) {
                  // Exact match on a client without a preset → reset auto-populated fields
                  updateClientData({ client: v, industry: '', subIndustry: '', country: '', revenue: '', employees: '' });
                } else {
                  // Free typing → only update the name, don't wipe other fields mid-type
                  updateClientData({ client: v });
                }
              }}
              readOnly={locked}
              options={CLIENT_OPTIONS}
            />
            <InputField
              label="Industry"
              value={clientData.industry}
              onChange={v => updateClientData({ industry: v })}
              readOnly={locked}
            />
            <div>
              <div className="text-xs text-gray-500 mb-1">Sub-Industry (NAICS-Code)</div>
              {locked ? (
                <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-xs text-gray-600 h-[30px] flex items-center truncate">
                  {clientData.subIndustry || '—'}
                </div>
              ) : (
                <select
                  className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-[#00A3E0]"
                  value={clientData.subIndustry}
                  onChange={e => updateClientData({ subIndustry: e.target.value })}
                >
                  <option value="">Select sub-industry…</option>
                  <option value="3331">Agriculture, Construction, and Mining Machinery Manufacturing (3331)</option>
                  <option value="33411">Computer and Peripheral Equipment Manufacturing (33411)</option>
                  <option value="424">Merchant Wholesalers, Nondurable Goods (424)</option>
                  <option value="2111">Petroleum / Chemical (2111)</option>
                  <option value="3113">Sugar and Confectionery Product Manufacturing (3113)</option>
                  <option value="33341">Ventilation, Heating, Air-Conditioning, and Commercial Refrigeration Equipment Manufacturing (33341)</option>
                  <option value="33361">Engine, Turbine, and Power Transmission Equipment Manufacturing (33361)</option>
                </select>
              )}
            </div>
            <InputField
              label="Country" placeholder="e.g. Germany"
              value={clientData.country}
              onChange={v => updateClientData({ country: v })}
              readOnly={locked}
            />
            <InputField
              label="Number of employees" placeholder="e.g. 1.500"
              value={clientData.employees}
              onChange={v => updateClientData({ employees: formatThousands(v) })}
              readOnly={locked}
            />
            <InputField
              label="Revenue (€)" placeholder="e.g. 500.000.000"
              value={clientData.revenue}
              onChange={v => updateClientData({ revenue: formatThousands(v) })}
              readOnly={locked}
            />
          </div>

          {!showProcessScope && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleProfileNext}
                className="flex items-center gap-2 px-5 py-2 rounded text-xs font-semibold transition-all bg-[#00338D] text-white hover:bg-[#002C77]"
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Process Scope ────────────────────────────────── */}
      {showProcessScope && (
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <SectionHeader title="Which processes would you like to optimize?" step={2} done={!!savedSnapshot && !isEditing} />
          <div className="p-4 space-y-4">
            <div className="space-y-3">
              {PROCESS_OPTIONS.map(p => {
                const isChecked = selectedProcesses.includes(p.id);
                const fteVal = (fteValues[p.id] || {})['fte'] || '';
                return (
                  <div key={p.id} className="flex items-center gap-4">
                    <label className={`flex items-center gap-2 min-w-[240px] ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => !locked && toggleProcess(p.id)}
                        disabled={locked}
                        className="w-4 h-4 accent-[#00338D]"
                      />
                      <span className="text-xs">{p.label}</span>
                    </label>
                    {isChecked && (
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          FTEs working in {p.label}
                        </span>
                        {p.id === 'P2P' ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setP2pBenchmarkOn(prev => !prev)}
                              disabled={locked}
                              className={`px-2.5 py-1.5 rounded text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                                p2pBenchmarkOn
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'bg-gray-100 border-gray-300 text-gray-500 hover:border-gray-400'
                              }`}
                            >
                              {p2pBenchmarkOn ? 'Benchmark: ON' : 'Benchmark: OFF'}
                            </button>
                            {p2pBenchmarkOn ? (
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-green-50 border border-green-300 text-xs font-semibold text-green-700 min-w-[80px]">
                                  <span className="w-2 h-2 rounded-sm bg-green-500 shrink-0" />
                                  {computedP2pFte !== null ? computedP2pFte.toFixed(1) : (
                                    <span className="font-normal text-gray-400 text-[10px]">
                                      {!clientData.subIndustry ? 'Select sub-industry' : 'Enter revenue'}
                                    </span>
                                  )}
                                </div>
                                <select
                                  value={p2pBenchmarkQuartile}
                                  onChange={e => setP2pBenchmarkQuartile(e.target.value as 'Q25' | 'Q50' | 'Q75')}
                                  disabled={locked}
                                  className="border border-green-300 rounded px-2 py-1.5 text-[10px] font-semibold text-green-700 bg-green-50 focus:outline-none focus:border-green-500 cursor-pointer"
                                >
                                  <option value="Q25">Q25</option>
                                  <option value="Q50">Q50</option>
                                  <option value="Q75">Q75</option>
                                </select>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={fteVal}
                                onChange={e => setFteValue(p.id, 'fte', formatThousands(e.target.value))}
                                placeholder="Enter FTE count"
                                readOnly={locked}
                                className={`w-36 border rounded px-3 py-1.5 text-xs focus:outline-none ${
                                  locked
                                    ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
                                    : 'border-gray-300 focus:border-[#00A3E0]'
                                }`}
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={fteVal}
                            onChange={e => setFteValue(p.id, 'fte', formatThousands(e.target.value))}
                            placeholder="Enter FTE count"
                            readOnly={locked}
                            className={`w-36 border rounded px-3 py-1.5 text-xs focus:outline-none ${
                              locked
                                ? 'border-gray-200 bg-gray-50 text-gray-600 cursor-default'
                                : 'border-gray-300 focus:border-[#00A3E0]'
                            }`}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save / Edit controls */}
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-gray-400">
                {savedSnapshot && !isEditing
                  ? `Last saved: ${savedSnapshot.savedAt}`
                  : 'Select the processes above, then save your configuration.'}
              </p>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <button
                    type="button"
                    onClick={handleSave}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold transition-all ${
                      saveFlash
                        ? 'bg-green-500 text-white'
                        : 'bg-[#00338D] text-white hover:bg-[#002C77]'
                    }`}
                  >
                    {saveFlash ? <><Check size={11} /> Saved!</> : <><Save size={11} /> Save</>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold border border-[#00338D] text-[#00338D] hover:bg-[#00338D]/5 transition-colors"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}
              </div>
            </div>

            {/* Saved summary banner */}
            {savedSnapshot && !isEditing && (
              <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-xs text-green-700 flex items-start gap-2">
                <Check size={12} className="mt-0.5 shrink-0 text-green-600" />
                <div>
                  <span className="font-semibold">Configuration saved.</span>
                  {' '}Client: <strong>{savedSnapshot.clientData.client}</strong> ·{' '}
                  Processes: <strong>{savedSnapshot.selectedProcesses.join(', ') || '—'}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
