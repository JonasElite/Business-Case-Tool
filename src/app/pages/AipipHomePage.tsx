import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ChevronRight, Save, Pencil, Check, RotateCcw, Download } from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { ClientData } from '../context/AppContext';
import { getFilteredUseCases } from '../data/mockData';

// ── Company persistence ──────────────────────────────────────────────────────

const COMPANIES_KEY = 'aibct_aipip_companies';

interface CompanyRecord {
  clientData: ClientData;
  selectedProcesses: string[];
  fteValues: Record<string, Record<string, string>>;
  selectedUseCases: string[];
  savedAt: string;
}

function loadCompaniesDB(): Record<string, CompanyRecord> {
  try {
    const raw = localStorage.getItem(COMPANIES_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCompaniesDB(db: Record<string, CompanyRecord>) {
  try { localStorage.setItem(COMPANIES_KEY, JSON.stringify(db)); } catch (_) {}
}

// ── Shared sub-components ───────────────────────────────────────────────────

const PROCESS_OPTIONS = [
  { id: 'P2P', label: 'Procurement-to-Pay (P2P)' },
  { id: 'O2C', label: 'Order to Cash (O2C)' },
  { id: 'R2R', label: 'Record to Report (R2R)' },
];

function SectionHeader({ title, step, done }: { title: string; step: number; done?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5"
      style={{ borderColor: '#DDE3ED', borderStyle: 'solid', borderWidth: 0, borderBottomWidth: 1, backgroundColor: '#F4F7FB' }}>
      <span className="flex items-center justify-center text-[10px] font-bold shrink-0"
        style={{ width: 20, height: 20, backgroundColor: done ? '#00338D' : '#DDE3ED', color: done ? '#fff' : '#6B7280' }}>
        {done ? <Check size={9} /> : step}
      </span>
      <div style={{ width: 12, height: 2, backgroundColor: '#00338D', flexShrink: 0 }} />
      <span className="text-[11px] font-bold tracking-wide text-[#0F1C2E]">{title}</span>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder = 'Enter here', required, readOnly, children,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; required?: boolean; readOnly?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </div>
      {children ?? (
        <input
          value={value}
          onChange={e => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full border rounded px-3 py-2 text-xs focus:outline-none ${
            readOnly
              ? 'border-[#DDE3ED] bg-[#F4F7FB] text-[#6B7280] cursor-default'
              : 'border-[#DDE3ED] focus:border-[#00338D]'
          }`}
        />
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function AipipHomePage() {
  const navigate = useNavigate();
  const {
    selectedProcesses, toggleProcess,
    clientData, updateClientData,
    fteValues, setFteValue,
    selectedUseCases, toggleUseCase,
    restoreSnapshot, resetAll,
  } = useApp();

  const availableUseCases = getFilteredUseCases(selectedProcesses);

  const [showProcessScope, setShowProcessScope] = useState(false);
  const [showUseCaseScope, setShowUseCaseScope] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [saveFlash, setSaveFlash] = useState(false);

  // Company database
  const [companiesDB, setCompaniesDB] = useState<Record<string, CompanyRecord>>(loadCompaniesDB);
  // Which saved company was loaded (null = none)
  const [loadedCompany, setLoadedCompany] = useState<string | null>(null);

  // Autocomplete
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCompanies = useMemo(() => {
    const q = clientData.client.trim().toLowerCase();
    if (!q) return Object.keys(companiesDB);
    return Object.keys(companiesDB).filter(n => n.toLowerCase().startsWith(q));
  }, [clientData.client, companiesDB]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const profileComplete = clientData.client.trim() !== '';

  const handleSelectCompany = (name: string) => {
    const record = companiesDB[name];
    if (!record) return;
    updateClientData(record.clientData);
    restoreSnapshot({
      clientData: record.clientData,
      selectedProcesses: record.selectedProcesses,
      fteValues: record.fteValues,
      selectedUseCases: record.selectedUseCases,
      showProcessScope: true,
      showUseCaseScope: true,
      savedAt: record.savedAt,
    });
    setShowProcessScope(true);
    setShowUseCaseScope(true);
    setLoadedCompany(name);
    setShowDropdown(false);
  };

  const handleLoadAndGo = () => {
    navigate('/aipip/simulator');
  };

  const handleProfileNext = () => {
    if (profileComplete) setShowProcessScope(true);
  };

  const handleProcessNext = () => {
    setShowUseCaseScope(true);
  };

  const handleSave = () => {
    const record: CompanyRecord = {
      clientData: { ...clientData },
      selectedProcesses: [...selectedProcesses],
      fteValues: JSON.parse(JSON.stringify(fteValues)),
      selectedUseCases: [...selectedUseCases],
      savedAt: new Date().toLocaleString('de-DE'),
    };
    const newDB = { ...companiesDB, [clientData.client]: record };
    setCompaniesDB(newDB);
    saveCompaniesDB(newDB);
    setIsEditing(false);
    setSaveFlash(true);
    setTimeout(() => {
      setSaveFlash(false);
      navigate('/aipip/simulator');
    }, 700);
  };

  const handleRestart = () => {
    resetAll();
    setShowProcessScope(false);
    setShowUseCaseScope(false);
    setIsEditing(true);
    setLoadedCompany(null);
    setShowDropdown(false);
  };

  const locked = !isEditing;

  return (
    <div className="space-y-4 max-w-full pt-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#00338D]">Project Setup</h2>
        <button
          type="button"
          onClick={handleRestart}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
        >
          <RotateCcw size={12} />
          Restart
        </button>
      </div>

      {/* ── Step 1: Client Profile Setup ─────────────────────────────── */}
      <div className="bg-white" style={{ border: '1px solid #DDE3ED' }}>
        <SectionHeader title="Client Profile Setup" step={1} done={showProcessScope} />
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">

            {/* Company name with autocomplete */}
            <div>
              <div className="text-xs text-gray-500 mb-1">
                Client name<span className="text-red-400 ml-0.5">*</span>
              </div>
              <div className="relative" ref={dropdownRef}>
                <input
                  value={clientData.client}
                  onChange={e => {
                    updateClientData({ client: e.target.value });
                    setLoadedCompany(null);
                    setShowDropdown(true);
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Type to search or enter new"
                  readOnly={locked}
                  className={`w-full border rounded px-3 py-2 text-xs focus:outline-none ${
                    locked ? 'border-[#DDE3ED] bg-[#F4F7FB] text-[#6B7280] cursor-default'
                           : 'border-[#DDE3ED] focus:border-[#00338D]'
                  }`}
                />
                {/* Dropdown */}
                {showDropdown && !locked && (
                  <div className="absolute top-full left-0 right-0 mt-0.5 z-40 bg-white border border-[#DDE3ED] shadow-md max-h-48 overflow-y-auto">
                    {filteredCompanies.length > 0 ? (
                      filteredCompanies.map(name => (
                        <button
                          key={name}
                          type="button"
                          onMouseDown={() => handleSelectCompany(name)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-[#00338D]/5 flex items-center justify-between group"
                        >
                          <span className="font-medium text-gray-700">{name}</span>
                          <span className="text-[10px] text-gray-400 group-hover:text-[#00338D]">
                            {companiesDB[name].savedAt}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-400 italic">No saved companies found</div>
                    )}
                  </div>
                )}
              </div>
              {/* Load saved data banner */}
              {loadedCompany && (
                <button
                  type="button"
                  onClick={handleLoadAndGo}
                  className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                >
                  <Download size={11} />
                  Load saved data for "{loadedCompany}"
                </button>
              )}
            </div>

            <Field label="Industry" value={clientData.industry}
              onChange={v => updateClientData({ industry: v })} readOnly={locked} />

            <div>
              <div className="text-xs text-gray-500 mb-1">Sub-Industry (NAICS-Code)</div>
              {locked ? (
                <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-xs text-gray-600">
                  {clientData.subIndustry || '—'}
                </div>
              ) : (
                <select
                  className="w-full border border-[#DDE3ED] px-3 py-2 text-xs focus:outline-none focus:border-[#00A3E0]"
                  value={clientData.subIndustry}
                  onChange={e => updateClientData({ subIndustry: e.target.value })}
                >
                  <option value="">Select sub-industry…</option>
                  <option value="3241">3241 – Petroleum &amp; Coal Products</option>
                  <option value="3251">3251 – Basic Chemical Mfg</option>
                  <option value="4231">4231 – Motor Vehicle &amp; Parts Wholesalers</option>
                  <option value="5211">5211 – Monetary Authorities</option>
                  <option value="5221">5221 – Depository Credit Intermediation</option>
                </select>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Number of employees" placeholder="e.g. 1500"
              value={clientData.employees} onChange={v => updateClientData({ employees: v })} readOnly={locked} />
            <Field label="Country" placeholder="e.g. Germany"
              value={clientData.country} onChange={v => updateClientData({ country: v })} readOnly={locked} />
            <Field label="Revenue (€)" placeholder="e.g. 500,000,000"
              value={clientData.revenue} onChange={v => updateClientData({ revenue: v })} readOnly={locked} />
          </div>

          {!showProcessScope && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleProfileNext}
                disabled={!profileComplete}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold transition-all ${
                  profileComplete ? 'bg-[#00338D] text-white hover:bg-[#002d7a]'
                                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Next <ChevronRight size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Step 2: Process Scope ─────────────────────────────────────── */}
      {showProcessScope && (
        <div className="bg-white" style={{ border: '1px solid #DDE3ED' }}>
          <SectionHeader title="Which processes would you like to optimize?" step={2} done={showUseCaseScope} />
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
                        <label className="text-xs text-gray-500 whitespace-nowrap">FTEs working in {p.label}</label>
                        <input
                          type="text"
                          value={fteVal}
                          onChange={e => setFteValue(p.id, 'fte', e.target.value)}
                          placeholder="Enter FTE count"
                          readOnly={locked}
                          className={`w-36 border rounded px-3 py-1.5 text-xs focus:outline-none ${
                            locked ? 'border-[#DDE3ED] bg-[#F4F7FB] text-[#6B7280] cursor-default'
                                   : 'border-[#DDE3ED] focus:border-[#00338D]'
                          }`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {!showUseCaseScope && (
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleProcessNext}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-semibold bg-[#00338D] text-white hover:bg-[#002d7a] transition-colors"
                >
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 3: Use Case Scope ────────────────────────────────────── */}
      {showUseCaseScope && (
        <div className="bg-white" style={{ border: '1px solid #DDE3ED' }}>
          <SectionHeader title="Select the tools you want to calculate the business case for" step={3} done={!isEditing} />
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Select tools below, then save to continue to AIPIP.</p>
              <button
                type="button"
                onClick={handleSave}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold transition-all ${
                  saveFlash ? 'bg-green-500 text-white' : 'bg-[#00338D] text-white hover:bg-[#002d7a]'
                }`}
              >
                {saveFlash ? <><Check size={11} /> Saved!</> : <><Save size={11} /> Save & Open AIPIP</>}
              </button>
            </div>
            <div className="space-y-2">
              {availableUseCases.map(uc => (
                <label key={uc.id} className={`flex items-center gap-2 ${locked ? 'cursor-default' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={selectedUseCases.includes(uc.id)}
                    onChange={() => !locked && toggleUseCase(uc.id)}
                    disabled={locked}
                    className="w-4 h-4 accent-[#00338D]"
                  />
                  <span className="text-xs">{uc.name}</span>
                </label>
              ))}
              {availableUseCases.length === 0 && (
                <p className="text-xs text-gray-400 italic">Select at least one process above to see available tools.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
