import React, { useState, useEffect } from 'react';
import { formatThousands } from '../utils/formatNumber';
import { ChevronUp, ChevronDown, Package, ArrowLeft, Pencil, Check, Info, BookmarkCheck, RotateCcw, HelpCircle, Save } from 'lucide-react';
import { useNavigate } from 'react-router';
import { BusinessCaseLogicModal } from '../components/BusinessCaseLogicModal';
import { USE_CASES, PROCESSES } from '../data/mockData';
import { useApp } from '../context/AppContext';
import {
  Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Line, ComposedChart, ReferenceArea, ReferenceLine,
} from 'recharts';

// ── Baselining persistence (per company × per confidence level) ──────────────

const BASELINING_KEY = 'aibct_baselining_by_company';

interface BaselineRecord {
  invoicesPerYear: string;
  totalFTEs: string;
  costPerFTE: string;
  implementationPeriod: string;
  fullyAutomatedPct: string;
  efficiencyGainRemainingPct: string;
}

type BaselineDB = Record<string, Record<string, BaselineRecord>>; // company → confidence → fields

function loadBaselineDB(): BaselineDB {
  try { return JSON.parse(localStorage.getItem(BASELINING_KEY) || '{}'); } catch { return {}; }
}

function saveBaselineDB(db: BaselineDB) {
  try { localStorage.setItem(BASELINING_KEY, JSON.stringify(db)); } catch (_) {}
}

// Generic per-use-case baselining (custom card fields, e.g. AI PR Creation)
const CUSTOM_BASELINING_KEY = 'aibct_custom_baselining_by_usecase';
type CustomBaselineDB = Record<string, Record<string, string>>; // scenarioKey → field map

function loadCustomBaselineDB(): CustomBaselineDB {
  try { return JSON.parse(localStorage.getItem(CUSTOM_BASELINING_KEY) || '{}'); } catch { return {}; }
}

function saveCustomBaselineDB(db: CustomBaselineDB) {
  try { localStorage.setItem(CUSTOM_BASELINING_KEY, JSON.stringify(db)); } catch (_) {}
}

export interface BaselineField {
  key: string;
  label: string;
  format?: 'percent' | 'euro' | 'number';
}

export interface BaselineCard {
  title: string;
  fields: BaselineField[];
}

export interface DeepDiveRow {
  process: string;
  l2: string;
  name: string;
  influence: string;
  desc?: string;
  improvement: number;   // percent, e.g. 10
  fteBaseline: number;
  asIs: number;          // percent
  withAI: number;        // percent
  ftePotential: number;
  efficiency: number;    // € per year
  carryOver: number | null;
  material: number | null;
  overall: number;
}

// ─────────────────────────────────────────────────────────────────────────────

const SCENARIO_OPTIMIZATION: Record<string, number> = {
  'Conservative': 0.35,
  'Moderate': 0.55,
  'Optimistic': 0.75,
};

function parseNumber(value: string): number {
  if (!value) return 0;
  const s = value.trim();
  // de-DE: comma = decimal separator, periods = thousands separators
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  // No comma: if last period has fewer than 3 trailing digits, treat it as a decimal point
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx >= 0 && s.length - dotIdx - 1 !== 3) {
    return parseFloat(s.slice(0, dotIdx).replace(/\./g, '') + '.' + s.slice(dotIdx + 1)) || 0;
  }
  return parseFloat(s.replace(/\./g, '')) || 0;
}

interface BusinessCaseData {
  year: string;
  yearNum: number;
  baselineCost: number;
  recurringCosts: number;
  nonRecurringCosts: number | null;
  benefits: number;
  netSavings: number;
  netSavingsAccumulated: number;
}

function calculateBusinessCase(
  invoicesPerYear: string,
  totalFTEs: string,
  costPerFTE: string,
  percentageMeetingConfidence: string,
  projectFees: string,
  feePerInvoice: string,
  infrastructureHosting: string,
  supportFees: string,
  currentOcrFeesPerYear: string,
  implementationPeriod: string,
  overheadPct: string,
): { data: BusinessCaseData[], totalSavings: number, percentage: string } | null {
  const invoices = parseNumber(invoicesPerYear);
  const ftes = parseNumber(totalFTEs);
  const fteYearlyCost = parseNumber(costPerFTE) * (1 + parseNumber(overheadPct) / 100);
  const projFees = parseNumber(projectFees);
  const invoiceFee = parseNumber(feePerInvoice);
  const infraCost = parseNumber(infrastructureHosting);
  const support = parseNumber(supportFees);
  const currentTool = parseNumber(currentOcrFeesPerYear);
  const optimizationRate = parseNumber(percentageMeetingConfidence) / 100;
  const implPeriod = Math.max(0, implementationPeriod.trim() !== '' ? parseNumber(implementationPeriod) : 6);

  if (!invoices || !ftes || !fteYearlyCost || !optimizationRate) {
    return null;
  }

  const baselineCost = ftes * fteYearlyCost;
  // Labor saved by AI = confidence% of invoices processed autonomously × full FTE labor cost
  const aiLaborSavings = optimizationRate * baselineCost;
  // Recurring costs = AI solution running costs
  const recurringCost = (invoices * invoiceFee) + infraCost + support;
  // Full-year operational net saving (before any pro-ration)
  const fullYearNetSaving = aiLaborSavings + currentTool - recurringCost;

  const data: BusinessCaseData[] = [];
  let accumulated = 0;

  for (let year = 1; year <= 5; year++) {
    // Months in this calendar year where the solution is already live
    const operationalMonths = Math.max(0, Math.min(12, year * 12 - implPeriod));
    const fraction = operationalMonths / 12;
    const nonRecurring = year === 1 ? projFees : 0;
    const netSavings = fullYearNetSaving * fraction - nonRecurring;
    accumulated += netSavings;

    data.push({
      year: `Year ${year}`,
      yearNum: year,
      baselineCost: Math.round(baselineCost / 1000),
      recurringCosts: -Math.round(recurringCost * fraction / 1000),
      nonRecurringCosts: year === 1 ? -Math.round(nonRecurring / 1000) : null,
      benefits: Math.round((aiLaborSavings + currentTool) * fraction / 1000),
      netSavings: Math.round(netSavings / 1000),
      netSavingsAccumulated: Math.round(accumulated / 1000),
    });
  }

  return {
    data,
    totalSavings: Math.round(accumulated / 1000),
    percentage: percentageMeetingConfidence,
  };
}

const MODEL_OPTIONS: Record<string, string[]> = {
  'Solution Model': ['SaaS / [X]aaS', 'Module / Add-on', 'Deployed standard software', 'Integration frameworks', 'Custom development'],
  'Operating Model': ['SaaS (AI-as-a-Service)', 'AI Platform-as-a-Service', 'Hybrid', 'On-prem / self-hosted'],
  'Licensing & Pricing Model': ['License', 'Seat-based', 'Open-source', 'Usage-based', 'Credit-based', 'Outcome-based'],
  'Org Fit Model': ['Fit to existing AI', 'Organizational readiness', 'Data readiness', 'Contract specifications', 'Contingency'],
};

const MULTI_SELECT_MODELS = new Set(['Org Fit Model']);

// Default Client Baselining values — keyed by scenario then confidence level
type BaselineFields = {
  invoicesPerYear: string; totalFTEs: string; costPerFTE: string;
  implementationPeriod: string; fullyAutomatedPct: string;
  efficiencyGainRemainingPct: string; overheadPct: string;
};

const DEFAULT_BASELINING: Record<string, Record<string, BaselineFields>> = {
  'Full Roll out': {
    '85%': { invoicesPerYear:'468925', totalFTEs:'30',   costPerFTE:'28753.32', implementationPeriod:'6', fullyAutomatedPct:'16.2', efficiencyGainRemainingPct:'50', overheadPct:'30' },
    '90%': { invoicesPerYear:'468925', totalFTEs:'30',   costPerFTE:'28753.32', implementationPeriod:'6', fullyAutomatedPct:'11.2', efficiencyGainRemainingPct:'50', overheadPct:'30' },
    '95%': { invoicesPerYear:'468925', totalFTEs:'30',   costPerFTE:'28753.32', implementationPeriod:'6', fullyAutomatedPct:'7',    efficiencyGainRemainingPct:'50', overheadPct:'30' },
  },
  'Siemens Energy': {
    '85%': { invoicesPerYear:'', totalFTEs:'', costPerFTE:'75000', implementationPeriod:'6', fullyAutomatedPct:'20', efficiencyGainRemainingPct:'50', overheadPct:'20' },
    '90%': { invoicesPerYear:'', totalFTEs:'', costPerFTE:'75000', implementationPeriod:'6', fullyAutomatedPct:'15', efficiencyGainRemainingPct:'50', overheadPct:'20' },
    '95%': { invoicesPerYear:'', totalFTEs:'', costPerFTE:'75000', implementationPeriod:'6', fullyAutomatedPct:'10', efficiencyGainRemainingPct:'50', overheadPct:'20' },
  },
};

const EMPTY_BASELINING: BaselineFields = {
  invoicesPerYear: '', totalFTEs: '', costPerFTE: '',
  implementationPeriod: '', fullyAutomatedPct: '',
  efficiencyGainRemainingPct: '', overheadPct: '',
};

function getDefaultBaselining(scenario: string, confidence: string): BaselineFields {
  return DEFAULT_BASELINING[scenario]?.[confidence] ?? EMPTY_BASELINING;
}

interface ScenarioCard {
  title: string;
  description: string;
  tags: string[];
  image?: string;
}

export interface AipipSummaryValues {
  roi: number | null;       // percent, e.g. 438
  npv: number;              // k€
  benefits: number;         // k€ total 5Y
  oneTime: number;          // k€
  runY5: number;            // k€ total running 5Y
  totalSavings: number;     // k€ net 5Y
}

interface AipipPageProps {
  onBack?: () => void;
  onValuesChange?: (values: AipipSummaryValues) => void;
  useCaseId?: string;
  title?: string;
  subtitle?: string;
  summaryTitle?: string;
  summaryDescription?: string;
  scenarioOverview?: ScenarioCard[];
  scenarioOptions?: string[];
  baselineCards?: BaselineCard[];
  baselineDefaults?: Record<string, Record<string, string>>;
  deepDiveDefaults?: Record<string, DeepDiveRow[]>;
  valueDriverDefaults?: Record<string, { processEfficiency: number; carryOver: number; material: number; totalBenefits: number }>;
  annualDefaults?: Record<string, { totalBenefits: number; processEfficiency: number; carryOver: number; material: number; netBenefits: number; cumNpv: number; roi: number }>;
  defaultSelectedModels?: Record<string, string | string[]>;
  phaseDefaults?: Record<string, { poc: number; aiTraining: number; implementation: number; aiConsumption: number; infrastructure: number; itSupport: number; costPerPR?: number }>;
  prFeeDefaults?: Record<string, { projectFees: string; feePerPR: string; infrastructureHosting: string; supportFees: string; aiConsumption: string }>;
  // Label for the first benefit row in the annual-view calculation table (baselineCards path)
  annualEfficiencyLabel?: string;
  // Override the Fees section fields (baselineCards path)
  feeFields?: { key: string; label: string; prefix?: string }[];
  // Override the Value Driver Breakdown rows (baselineCards path)
  valueDriverBreakdown?: { name: string; active: boolean; source?: 'pe' | 'co' | 'mat' | 'total' }[];
  // Primary driver label shown in the Value Driver Breakdown summary
  primaryDriverLabel?: string;
  // Hide the Total Cost of Ownership section entirely
  hideTco?: boolean;
  // Level 3 sub-processes the case can be applied to (renders a checkbox scope selector in Client Baselining)
  subProcessOptions?: string[];
  // Default Applied Sub-Process (L2 → L3) this case maps to, so saved value drivers land in the
  // right deep dive row even if the user never opens the selector.
  defaultCaseL2?: string;
  defaultCaseL3?: string;
}

// "Invoices processed per FTE (AP)" benchmark values by NAICS code
const INVOICES_PER_FTE_AP: Record<string, { Q25: number; Q50: number; Q75: number }> = {
  '3331':  { Q25: 7444.4,    Q50: 10344.83, Q75: 12000    },
  '33411': { Q25: 13291.67,  Q50: 20375,    Q75: 24000    },
  '424':   { Q25: 6744.9,    Q50: 9547.6,   Q75: 14750    },
  '2111':  { Q25: 3441.2,    Q50: 9600,     Q75: 17500    },
  '3113':  { Q25: 8928.5,    Q50: 12500,    Q75: 16125    },
  '33341': { Q25: 13333.33,  Q50: 16666.6,  Q75: 16904.7  },
  '33361': { Q25: 9250,      Q50: 14875,    Q75: 20789    },
};
// Overall Client FTE allocation for the "Validate, Approve, & Post Invoices / Credit Notes"
// subprocess = process allocation (Invoicing 0.35) × sub-process allocation (0.82). Kept in sync
// with SUBPROCESS_FTE_ALLOCATION × L4_FTE_ALLOCATION in Benchmarking.tsx.
const INVOICE_SUBPROCESS_ALLOC = 0.35 * 0.82;
// Level 3 Subprocess Summary override key for the invoice subprocess that the AI PIP
// "Total FTEs for invoicing" field is linked to. Must match the key built in Benchmarking.tsx
// (`${processId}::${step}::${l4}`).
const INVOICE_L3_FTE_KEY = 'P2P::Invoice Processing & Payment::Validate, Approve, & Post Invoices / Credit Notes';

export function AipipPage({
  onBack,
  onValuesChange,
  useCaseId = 'ai-pip',
  title = 'AIPIP - Business Case Simulator',
  subtitle = 'AI Powered Invoice Processing',
  summaryTitle,
  summaryDescription,
  scenarioOverview,
  scenarioOptions = ['Custom', 'Full Roll out', 'Siemens Energy'],
  baselineCards,
  baselineDefaults,
  deepDiveDefaults,
  valueDriverDefaults,
  annualDefaults,
  defaultSelectedModels,
  phaseDefaults,
  prFeeDefaults,
  annualEfficiencyLabel = 'Process Efficiency Enhancement',
  feeFields = [
    { key: 'projectFees', label: 'Project fees', prefix: '€' },
    { key: 'feePerPR', label: 'Fee per Purchase Requisition', prefix: '€' },
    { key: 'infrastructureHosting', label: 'Infrastructure & hosting per year', prefix: '€' },
    { key: 'supportFees', label: 'Support fees per year', prefix: '€' },
    { key: 'aiConsumption', label: 'AI consumption', prefix: '€' },
  ],
  valueDriverBreakdown = [
    { name: 'Automation-driven cost savings', active: true, source: 'pe' },
    { name: 'FTE Costs Savings', active: false },
    { name: 'Working Capital Optimization', active: false },
    { name: 'Carry-over Effect', active: true, source: 'co' },
    { name: 'Material Cost Reduction', active: true, source: 'mat' },
    { name: 'Profit Assurance', active: false },
  ],
  primaryDriverLabel = 'Material Cost Reduction',
  hideTco = false,
  subProcessOptions,
  defaultCaseL2 = '',
  defaultCaseL3 = '',
}: AipipPageProps = {}) {
  const navigate = useNavigate();
  const { clientData, fteValues, l3FteOverrides, saveCaseDrivers, savedCaseDrivers, saveCaseInputs, savedCaseInputs, selectedProcesses } = useApp();
  // Previously-saved editable inputs for this case (baselining, fees, scenario, etc.), if any
  const savedInputs = savedCaseInputs[useCaseId];
  const savedVal = <T,>(key: string, fallback: T): T =>
    savedInputs && savedInputs[key] !== undefined ? (savedInputs[key] as T) : fallback;

  // L2 → L3 sub-process cascade options, drawn from the selected process taxonomy.
  // Used by the Client Baselining "Applied Sub-Process" selector in every case.
  const l2l3Options = React.useMemo(() => {
    const procIds = (selectedProcesses && selectedProcesses.length > 0) ? selectedProcesses : Object.keys(PROCESSES);
    const map: Record<string, string[]> = {};
    procIds.forEach(pid => {
      const proc = PROCESSES[pid];
      if (!proc) return;
      const disabled = new Set(proc.disabledSteps ?? []);
      proc.steps.filter(s => !disabled.has(s)).forEach(l2 => {
        const l3s = (proc.l3KPIs[l2] ?? []).map(k => k.l4).filter((v): v is string => !!v);
        if (l3s.length > 0) map[l2] = Array.from(new Set([...(map[l2] ?? []), ...l3s]));
      });
    });
    // Always guarantee this case's default Applied Sub-Process (L2 → L3) is available
    // as a dropdown option, even if its parent process isn't in the current scope.
    if (defaultCaseL2) {
      map[defaultCaseL2] = Array.from(new Set([
        ...(map[defaultCaseL2] ?? []),
        ...(defaultCaseL3 ? [defaultCaseL3] : []),
      ]));
    }
    return map;
  }, [selectedProcesses, defaultCaseL2, defaultCaseL3]);
  // Multi-select Applied Sub-Processes: maps each selected Level 2 → array of selected Level 3s.
  // Any number of L2 groups, each with any number of L3s, can be selected per case.
  const [caseSubProcs, setCaseSubProcs] = useState<Record<string, string[]>>(() => {
    const saved = savedVal<Record<string, string[]> | undefined>('caseSubProcs', undefined);
    if (saved) return saved;
    // Migrate from the previous single-select fields / prop defaults.
    const l2 = savedVal('caseL2', '') || defaultCaseL2;
    const l3 = savedVal('caseL3', '') || defaultCaseL3;
    return l2 && l3 ? { [l2]: [l3] } : {};
  });
  // Selection view is collapsed/hidden by default; user toggles it open.
  const [showSubProcSelector, setShowSubProcSelector] = useState(false);

  // Flat list of every selected Level 3 across all selected Level 2 groups.
  const selectedCaseL3s = React.useMemo(
    () => Object.values(caseSubProcs).flat(),
    [caseSubProcs],
  );
  const selectedCaseL3Key = selectedCaseL3s.join('|');

  const toggleCaseL3 = (l2: string, l3: string) =>
    setCaseSubProcs(prev => {
      const current = prev[l2] ?? [];
      const next = current.includes(l3)
        ? current.filter(x => x !== l3)
        : [...current, l3];
      const out = { ...prev };
      if (next.length > 0) out[l2] = next;
      else delete out[l2];
      return out;
    });

  // Selected Level 3 sub-processes for scope-based use cases (e.g. SCC). Default: all selected.
  const [selectedSubProcesses, setSelectedSubProcesses] = useState<string[]>(() => savedVal('selectedSubProcesses', subProcessOptions ?? []));
  const toggleSubProcess = (name: string) =>
    setSelectedSubProcesses(prev =>
      prev.includes(name) ? prev.filter(p => p !== name) : [...prev, name]);
  const [caseSavedFlash, setCaseSavedFlash] = useState(false);
  const companyName = clientData.client.trim();
  const aipipUseCase = USE_CASES.find(uc => uc.id === useCaseId)!;
  // Stable boolean — avoids inline-array baselineCards prop causing dep-array churn
  const isBaselineMode = !!baselineCards;

  const [selectedModels, setSelectedModels] = useState<Record<string, string | string[]>>(() =>
    savedVal('selectedModels', defaultSelectedModels ?? {
      'Solution Model': 'SaaS / [X]aaS',
      'Operating Model': 'SaaS (AI-as-a-Service)',
      'Licensing & Pricing Model': 'License',
      'Org Fit Model': [],
    }));

  const [baselineEditing, setBaselineEditing] = useState(false);

  const [baseliningData, setBaseliningsData] = useState(() => savedVal('baseliningData', {
    ...EMPTY_BASELINING,
    confidenceLevel: '90%',
    percentageMeetingConfidence: '',
    currentOcrCostPerInvoice: '0',
  }));

  const [baselingSaveFlash, setBaselingSaveFlash] = useState(false);

  // Generic field values for custom baseline cards (e.g. AI PR Creation)
  const [customBaseline, setCustomBaseline] = useState<Record<string, string>>(() => savedVal('customBaseline', {}));

  const [scenarios, setScenarios] = useState<string[]>(() => savedVal('scenarios', scenarioOptions));
  const [selectedScenario, setSelectedScenario] = useState(() => savedVal('selectedScenario', scenarioOptions[0] ?? 'Custom'));
  const [showScenarioDropdown, setShowScenarioDropdown] = useState(false);
  const [addingScenario, setAddingScenario] = useState(false);
  const [newScenarioName, setNewScenarioName] = useState('');
  const [baselineResetFlash, setBaselineResetFlash] = useState(false);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [showPrTable, setShowPrTable] = useState(false);
  const [showAipipTable, setShowAipipTable] = useState(false);
  const [prRampPcts, setPrRampPcts] = useState<number[]>(() => savedVal('prRampPcts', [0, 100, 100, 100, 100, 100]));
  const [aipipRampPcts, setAipipRampPcts] = useState<number[]>(() => savedVal('aipipRampPcts', [0, 70, 80, 90, 100, 100]));
  const [baseliningBenchmarkOn, setBaseliningBenchmarkOn] = useState(false);
  const [baseliningBenchmarkQuartile, setBaseliningBenchmarkQuartile] = useState<'Q25' | 'Q50' | 'Q75'>('Q50');

  // Compound key: use case + scenario + confidence level (keeps use cases isolated)
  const scenarioKey = (scenario: string, confidence: string) => `${useCaseId}::${scenario}::${confidence}`;

  // Apply saved data (scenario × confidence) or fall back to defaults when either changes.
  // Company-specific slot takes priority; global slot ensures both access paths stay in sync.
  useEffect(() => {
    const db = loadBaselineDB();
    const key = scenarioKey(selectedScenario, baseliningData.confidenceLevel);
    const saved = (companyName ? db[companyName]?.[key] : null) ?? db['__global__']?.[key];
    const source = saved ?? getDefaultBaselining(selectedScenario, baseliningData.confidenceLevel);
    setBaseliningsData(prev => ({
      ...prev,
      invoicesPerYear: source.invoicesPerYear,
      totalFTEs: source.totalFTEs,
      costPerFTE: source.costPerFTE,
      implementationPeriod: source.implementationPeriod,
      fullyAutomatedPct: source.fullyAutomatedPct,
      efficiencyGainRemainingPct: source.efficiencyGainRemainingPct,
    }));
    if (baselineCards) {
      const cdb = loadCustomBaselineDB();
      setCustomBaseline(cdb[key] || baselineDefaults?.[selectedScenario] || {});
    }
    setBaselineEditing(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseliningData.confidenceLevel, selectedScenario, companyName]);

  // Update scenario-specific fee defaults when scenario changes (skip if TCO apply controls fees)
  useEffect(() => {
    if (tcoApplied) return;
    const d = SCENARIO_FEE_DEFAULTS[selectedScenario];
    if (!d) return;
    setFeesData(prev => ({
      ...prev,
      projectFees: d.projectFees,
      ...(d.feePerInvoice !== undefined && { feePerInvoice: d.feePerInvoice }),
      ...(d.infrastructureHosting !== undefined && { infrastructureHosting: d.infrastructureHosting }),
      ...(d.supportFees !== undefined && { supportFees: d.supportFees }),
    }));
    if (d.ocrCostPerInvoice !== undefined) {
      setPhaseCosts(prev => ({ ...prev, ocrCostPerInvoice: d.ocrCostPerInvoice! }));
    }
    if (d.currentOcrCostPerInvoice !== undefined) {
      setBaseliningsData(prev => ({ ...prev, currentOcrCostPerInvoice: d.currentOcrCostPerInvoice! }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario]);

  const handleResetBaselining = () => {
    const defaults = getDefaultBaselining(selectedScenario, baseliningData.confidenceLevel);
    setBaseliningsData(prev => ({ ...prev, ...defaults }));
    if (baselineCards) setCustomBaseline(baselineDefaults?.[selectedScenario] || {});
    // Also reset scenario-specific fee defaults
    const fd = SCENARIO_FEE_DEFAULTS[selectedScenario];
    if (fd && !tcoApplied) {
      setFeesData(prev => ({
        ...prev,
        projectFees: fd.projectFees,
        ...(fd.feePerInvoice !== undefined && { feePerInvoice: fd.feePerInvoice }),
        ...(fd.infrastructureHosting !== undefined && { infrastructureHosting: fd.infrastructureHosting }),
        ...(fd.supportFees !== undefined && { supportFees: fd.supportFees }),
      }));
      if (fd.ocrCostPerInvoice !== undefined) setPhaseCosts(prev => ({ ...prev, ocrCostPerInvoice: fd.ocrCostPerInvoice! }));
      if (fd.currentOcrCostPerInvoice !== undefined) setBaseliningsData(prev => ({ ...prev, currentOcrCostPerInvoice: fd.currentOcrCostPerInvoice! }));
    }
    setBaselineEditing(false);
    setBaselineResetFlash(true);
    setTimeout(() => setBaselineResetFlash(false), 1500);
  };

  const handleSaveBaselining = () => {
    const db = loadBaselineDB();
    const key = scenarioKey(selectedScenario, baseliningData.confidenceLevel);
    const record: BaselineRecord = {
      invoicesPerYear: baseliningData.invoicesPerYear,
      totalFTEs: baseliningData.totalFTEs,
      costPerFTE: baseliningData.costPerFTE,
      implementationPeriod: baseliningData.implementationPeriod,
      fullyAutomatedPct: baseliningData.fullyAutomatedPct,
      efficiencyGainRemainingPct: baseliningData.efficiencyGainRemainingPct,
    };
    // Save under company-specific slot (if a company is set)
    if (companyName) {
      if (!db[companyName]) db[companyName] = {};
      db[companyName][key] = record;
    }
    // Always save to global slot so both access paths (standalone + embedded) stay in sync
    if (!db['__global__']) db['__global__'] = {};
    db['__global__'][key] = record;
    saveBaselineDB(db);
    // Persist generic card fields (custom baselines) under the same namespaced key
    if (baselineCards) {
      const cdb = loadCustomBaselineDB();
      cdb[key] = customBaseline;
      // Manual edits move the case off a preset scenario → status becomes "Custom".
      if (selectedScenario !== 'Custom' && scenarios.includes('Custom')) {
        const customKey = scenarioKey('Custom', baseliningData.confidenceLevel);
        cdb[customKey] = customBaseline;
        saveCustomBaselineDB(cdb);
        setSelectedScenario('Custom');
      } else {
        saveCustomBaselineDB(cdb);
      }
    }
    setBaselingSaveFlash(true);
    setTimeout(() => setBaselingSaveFlash(false), 2000);
  };

  const handleSelectScenario = (scenario: string) => {
    setSelectedScenario(scenario);
    setShowScenarioDropdown(false);
    setAddingScenario(false);
    setNewScenarioName('');
  };

  const handleAddScenario = () => {
    const name = newScenarioName.trim();
    if (!name || scenarios.includes(name)) return;
    setScenarios(prev => [...prev, name]);
    setSelectedScenario(name);
    setShowScenarioDropdown(false);
    setAddingScenario(false);
    setNewScenarioName('');
  };

  const [phaseCosts, setPhaseCosts] = useState(() => savedVal('phaseCosts', {
    poc: 50000,
    aiTraining: 50000,
    implementation: 100000,
    ocrImplementation: 0,
    ocrCostPerInvoice: 0,
  }));

  // AI PR Creation phase costs — scenario-driven defaults (independent of the AI PIP phaseCosts)
  const EMPTY_PR_PHASE = { poc: 0, aiTraining: 0, implementation: 0, aiConsumption: 0, infrastructure: 0, itSupport: 0, costPerPR: 0 };
  const [prPhaseCosts, setPrPhaseCosts] = useState<Record<string, number>>(
    () => savedVal('prPhaseCosts', phaseDefaults?.[scenarioOptions[0] ?? ''] ?? { ...EMPTY_PR_PHASE }));
  // Skip the scenario-driven reset on the first render when we've restored a saved case
  const skipPhaseResetRef = React.useRef(!!savedInputs);
  React.useEffect(() => {
    if (skipPhaseResetRef.current) { skipPhaseResetRef.current = false; return; }
    if (phaseDefaults) setPrPhaseCosts(phaseDefaults[selectedScenario] ?? { ...EMPTY_PR_PHASE });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScenario]);


  interface ScenarioFeeDefaults {
    projectFees: string;
    feePerInvoice?: string;
    infrastructureHosting?: string;
    supportFees?: string;
    ocrCostPerInvoice?: number; // phaseCosts field
    currentOcrCostPerInvoice?: string; // baselining field
  }
  const SCENARIO_FEE_DEFAULTS: Record<string, ScenarioFeeDefaults> = {
    'Custom':          { projectFees: '0', feePerInvoice: '0', infrastructureHosting: '0', supportFees: '0', ocrCostPerInvoice: 0, currentOcrCostPerInvoice: '0' },
    'Full Roll out':   { projectFees: '300000' },
    'Siemens Energy':  { projectFees: '300000', feePerInvoice: '0.60', infrastructureHosting: '50000', supportFees: '30000' },
  };

  const [feesData, setFeesData] = useState(() => savedVal('feesData', {
    projectFees: '0',
    feePerInvoice: '0',
    infrastructureHosting: '0',
    supportFees: '0',
  }));

  // AI PR Creation fees (separate from AI PIP feesData)
  const EMPTY_PR_FEES = { projectFees: '0', feePerPR: '0', infrastructureHosting: '0', supportFees: '0', aiConsumption: '0' };
  const [prFeesData, setPrFeesData] = useState(
    () => savedVal('prFeesData', prFeeDefaults?.[scenarioOptions[0] ?? ''] ?? { ...EMPTY_PR_FEES })
  );
  const skipFeesResetRef = React.useRef(!!savedInputs);
  React.useEffect(() => {
    if (skipFeesResetRef.current) { skipFeesResetRef.current = false; return; }
    setPrTcoApplied(false);
    if (prFeeDefaults) setPrFeesData(prFeeDefaults[selectedScenario] ?? { ...EMPTY_PR_FEES });
  }, [selectedScenario]); // eslint-disable-line react-hooks/exhaustive-deps
  const [prEditingFee, setPrEditingFee] = useState<Record<string, boolean>>({
    projectFees: false,
    feePerPR: false,
    infrastructureHosting: false,
    supportFees: false,
    aiConsumption: false,
  });
  const [prFeesResetFlash, setPrFeesResetFlash] = useState(false);
  const handleResetPrFees = () => {
    setPrFeesData(prFeeDefaults?.[selectedScenario] ?? { ...EMPTY_PR_FEES });
    setPrTcoApplied(false);
    setPrFeesResetFlash(true);
    setTimeout(() => setPrFeesResetFlash(false), 1200);
  };

  const [editingFee, setEditingFee] = useState<Record<string, boolean>>({
    projectFees: false,
    feePerInvoice: false,
    infrastructureHosting: false,
    supportFees: false,
    kpmgOcrCostPerInvoice: false,
  });
  const [editingPhase, setEditingPhase] = useState<Record<string, boolean>>({
    poc: false,
    aiTraining: false,
    implementation: false,
    ocrImplementation: false,
    ocrCostPerInvoice: false,
  });
  // Raw string buffer for decimal-safe editing of phase cost fields
  const [phaseRawValue, setPhaseRawValue] = useState('');


  const [barVisibility, setBarVisibility] = useState({
    nonRecurring: true,
    recurring: true,
    benefits: true,
    netSavings: true,
  });

  const [tcoApplied, setTcoApplied] = useState(false);
  const [tcoFlash, setTcoFlash] = useState(false);

  // Sync project fees when TCO Apply is active
  useEffect(() => {
    if (!tcoApplied) return;
    const projectFeesSum = phaseCosts.poc + phaseCosts.aiTraining + phaseCosts.implementation + phaseCosts.ocrImplementation;
    setFeesData(prev => ({ ...prev, projectFees: String(projectFeesSum) }));
  }, [tcoApplied, phaseCosts]);

  // AI PR Creation: Apply phase costs to Fees section
  const [prTcoApplied, setPrTcoApplied] = useState(false);
  const [prTcoFlash, setPrTcoFlash] = useState(false);

  useEffect(() => {
    if (!prTcoApplied) return;
    const projectFeesSum = prPhaseCosts.poc + prPhaseCosts.aiTraining + prPhaseCosts.implementation;
    setPrFeesData(prev => ({
      ...prev,
      projectFees: String(projectFeesSum),
      aiConsumption: String(prPhaseCosts.aiConsumption),
      infrastructureHosting: String(prPhaseCosts.infrastructure),
      supportFees: String(prPhaseCosts.itSupport),
      feePerPR: String(prPhaseCosts.costPerPR ?? 0),
    }));
  }, [prTcoApplied, prPhaseCosts]);

  const handleApplyPrTco = () => {
    const nextApplied = !prTcoApplied;
    setPrTcoApplied(nextApplied);
    if (nextApplied) {
      setPrTcoFlash(true);
      setTimeout(() => setPrTcoFlash(false), 1800);
    }
  };


  const handleApplyTco = () => {
    if (baselineCards) {
      const nextApplied = !prTcoApplied;
      setPrTcoApplied(nextApplied);
      if (nextApplied) {
        setPrTcoFlash(true);
        setTimeout(() => setPrTcoFlash(false), 1800);
      }
    } else {
      const nextApplied = !tcoApplied;
      setTcoApplied(nextApplied);
      if (nextApplied) {
        setTcoFlash(true);
        setTimeout(() => setTcoFlash(false), 1800);
      }
    }
  };

  const toggleBarVisibility = (bar: 'nonRecurring' | 'recurring' | 'benefits' | 'netSavings') => {
    setBarVisibility(prev => ({ ...prev, [bar]: !prev[bar] }));
  };

  // Derived calculations from the two new baselining fields
  const darkProcessedInvoices = React.useMemo(() => {
    const inv = parseNumber(baseliningData.invoicesPerYear);
    const autoPct = parseNumber(baseliningData.fullyAutomatedPct) / 100;
    if (!inv || !autoPct) return null;
    return inv * autoPct;
  }, [baseliningData.invoicesPerYear, baseliningData.fullyAutomatedPct]);

  // Client FTE for the invoice subprocess ("Validate, Approve, & Post Invoices / Credit Notes"),
  // linked to the Level 3 Subprocess Summary. A user edit there (pencil icon) is persisted as an
  // override and wins; otherwise it falls back to the benchmark allocation (P2P FTE × 0.19).
  const invoiceClientFte = React.useMemo(() => {
    if (baselineCards) return null;
    const override = l3FteOverrides[INVOICE_L3_FTE_KEY];
    if (override !== undefined && override.trim() !== '') {
      const n = parseNumber(override);
      return Number.isFinite(n) && n > 0 ? n : null;
    }
    const totalP2pFte = parseNumber((fteValues['P2P'] || {})['fte'] || '');
    if (!totalP2pFte) return null;
    return totalP2pFte * INVOICE_SUBPROCESS_ALLOC;
  }, [baselineCards, l3FteOverrides, fteValues]);

  // Whether the AI PIP "Total FTEs for invoicing" field is driven by the Level 3 Client FTE.
  const invoiceFteLinked = !baselineCards && useCaseId === 'ai-pip' && invoiceClientFte !== null;

  // Benchmark: Invoices per year derived from the linked invoice Client FTE.
  const benchmarkBaselining = React.useMemo(() => {
    if (!baseliningBenchmarkOn || baselineCards || invoiceClientFte === null) return null;
    const metrics = INVOICES_PER_FTE_AP[clientData.subIndustry];
    const invoicesPerYear = metrics
      ? Math.round(metrics[baseliningBenchmarkQuartile] * invoiceClientFte)
      : null;
    return { totalFTEs: parseFloat(invoiceClientFte.toFixed(2)), invoicesPerYear };
  }, [baseliningBenchmarkOn, baseliningBenchmarkQuartile, clientData.subIndustry, invoiceClientFte, baselineCards]);

  // Mirror the Level 3 Client FTE into "Total FTEs for invoicing" for the AI PIP case, so the
  // Deep Dive and the Business Case always stay consistent. Runs whenever the linked value,
  // scenario or confidence changes (re-applies after scenario/confidence resets the baselining).
  React.useEffect(() => {
    if (!invoiceFteLinked || invoiceClientFte === null) return;
    const formatted = String(parseFloat(invoiceClientFte.toFixed(2)));
    setBaseliningsData(prev => prev.totalFTEs === formatted ? prev : { ...prev, totalFTEs: formatted });
  }, [invoiceFteLinked, invoiceClientFte, selectedScenario, baseliningData.confidenceLevel]);

  // Benchmark also populates Invoices per year.
  React.useEffect(() => {
    if (benchmarkBaselining !== null && benchmarkBaselining.invoicesPerYear !== null) {
      setBaseliningsData(prev => ({ ...prev, invoicesPerYear: String(benchmarkBaselining.invoicesPerYear) }));
    }
  }, [benchmarkBaselining]);

  // Net Efficiency Gains = ((inv - dark) × effPct + dark) / inv
  const netEfficiencyGainsPct = React.useMemo(() => {
    const inv = parseNumber(baseliningData.invoicesPerYear);
    if (!inv) return null;
    const dark = darkProcessedInvoices ?? 0;
    const effPct = parseNumber(baseliningData.efficiencyGainRemainingPct) / 100;
    return (((inv - dark) * effPct) + dark) / inv * 100;
  }, [baseliningData.invoicesPerYear, baseliningData.efficiencyGainRemainingPct, darkProcessedInvoices]);

  const businessCaseResult = React.useMemo(() => {
    return calculateBusinessCase(
      baseliningData.invoicesPerYear,
      baseliningData.totalFTEs,
      baseliningData.costPerFTE,
      String(netEfficiencyGainsPct ?? 0),
      feesData.projectFees,
      String(parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice),
      feesData.infrastructureHosting,
      feesData.supportFees,
      String(parseNumber(baseliningData.invoicesPerYear) * parseNumber(baseliningData.currentOcrCostPerInvoice)),
      baseliningData.implementationPeriod,
      baseliningData.overheadPct,
    );
  }, [baseliningData, feesData, netEfficiencyGainsPct, phaseCosts.ocrCostPerInvoice]);

  // Calculate dynamic summary values — wired to Value Deep Dive and Phase Model
  const summaryValues = React.useMemo(() => {
    const invoices = parseNumber(baseliningData.invoicesPerYear);
    const ftes = parseNumber(baseliningData.totalFTEs);
    const fteYearlyCost = parseNumber(baseliningData.costPerFTE) * (1 + parseNumber(baseliningData.overheadPct) / 100);
    const invoiceFee = parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice;
    const infraCost = parseNumber(feesData.infrastructureHosting);
    const support = parseNumber(feesData.supportFees);
    const currentTool = invoices * parseNumber(baseliningData.currentOcrCostPerInvoice);

    // Net efficiency gains replaces percentageMeetingConfidence as the efficiency driver
    const efficiencyGains = (netEfficiencyGainsPct ?? 0) / 100;

    // Non-recurring costs = Project fees from Fees section (manual input)
    const nonRecurringCosts = parseNumber(feesData.projectFees);

    const implPeriod = Math.max(0, baseliningData.implementationPeriod.trim() !== '' ? parseNumber(baseliningData.implementationPeriod) : 6);
    const oneTimeCost = nonRecurringCosts;
    const hasBaselineInputs = invoices > 0 && ftes > 0 && fteYearlyCost > 0 && efficiencyGains > 0;

    // Recurring costs per year: AI running costs minus old tool fees saved
    const recurringCostsPerYear = (invoices * invoiceFee) + infraCost + support;

    const runningCost5Y = recurringCostsPerYear * 5;
    const totalCost = oneTimeCost + runningCost5Y;

    // Full-year net saving = AI labor savings − recurring costs
    const aiLaborSavingsPerYear = efficiencyGains * ftes * fteYearlyCost;
    const fullYearNetSaving = aiLaborSavingsPerYear + currentTool - recurringCostsPerYear;

    // Sum operational months across 5 years (for pro-ration by impl period)
    let totalOperationalMonths = 0;
    for (let y = 1; y <= 5; y++) {
      totalOperationalMonths += Math.max(0, Math.min(12, y * 12 - implPeriod));
    }
    const totalBenefits5Y = hasBaselineInputs ? fullYearNetSaving * (totalOperationalMonths / 12) : 0;

    // Current Recurring Costs/Y (Status Quo) = Total FTEs × Cost per FTE/year + Current Tool Fees/Year
    const currentRecurringCostPerYear = (ftes * fteYearlyCost) + currentTool;

    // Total benefits over 5 years with impl period pro-ration
    let totalBenefits = 0;
    if (hasBaselineInputs) {
      for (let year = 1; year <= 5; year++) {
        const operationalMonths = Math.max(0, Math.min(12, year * 12 - implPeriod));
        const fraction = operationalMonths / 12;
        const nonRecurring = year === 1 ? oneTimeCost : 0;
        totalBenefits += fullYearNetSaving * fraction - nonRecurring;
      }
    }

    // ROI = (Total Benefits - Project fees) / Project fees × 100
    const projectFeesTotal = parseNumber(feesData.projectFees);
    const roi = (projectFeesTotal > 0 && hasBaselineInputs)
      ? ((totalBenefits - projectFeesTotal) / projectFeesTotal) * 100
      : null;

    // Break-even = impl period + months to recover project fees from monthly net savings
    let breakEvenMonths = 999;
    if (hasBaselineInputs && projectFeesTotal > 0) {
      const monthlySavings = fullYearNetSaving / 12;
      if (monthlySavings > 0) {
        breakEvenMonths = implPeriod + projectFeesTotal / monthlySavings;
      }
    }

    return {
      roi: roi !== null ? roi.toFixed(2) : 'N/A',
      benefits: Math.round(totalBenefits5Y / 1000), // in k€
      cost: Math.round(totalCost / 1000), // in k€
      oneTime: Math.round(oneTimeCost / 1000), // in k€
      recurringPerYear: Math.round(recurringCostsPerYear / 1000), // in k€
      currentRecurringPerYear: Math.round(currentRecurringCostPerYear / 1000), // in k€
      breakEvenMonths: Math.round(breakEvenMonths),
    };
  }, [baseliningData, feesData, netEfficiencyGainsPct, phaseCosts.ocrCostPerInvoice]);

  // Ramp-adjusted AIPIP summary — reacts to editable ramp-up inputs
  const rampedSummary = React.useMemo(() => {
    if (!businessCaseResult) return null;
    let accum = 0;
    const rows = businessCaseResult.data.map((d, i) => {
      const ramp = aipipRampPcts[i + 1] / 100;
      const rampedBenefits = d.benefits * ramp;
      const netSavings = rampedBenefits + d.recurringCosts + (d.nonRecurringCosts ?? 0);
      accum += netSavings;
      return { netSavings: Math.round(netSavings) };
    });

    // Break-even at monthly granularity, respecting the implementation period.
    // Benefits/recurring costs in the yearly data are pro-rated by operational months,
    // so we de-prorate them back to a full-year figure and only let them accrue in the
    // months after go-live (i.e. after the implementation period).
    const implPeriod = Math.max(0, businessCaseResult.data.length
      ? (baseliningData.implementationPeriod.trim() !== '' ? parseNumber(baseliningData.implementationPeriod) : 6)
      : 6);
    const oneTimeCost = -(businessCaseResult.data[0]?.nonRecurringCosts ?? 0); // stored negative
    const monthlyNet = businessCaseResult.data.map((d, i) => {
      const opMonths = Math.max(0, Math.min(12, (i + 1) * 12 - implPeriod));
      const frac = opMonths / 12;
      if (frac <= 0) return 0;
      const ramp = aipipRampPcts[i + 1] / 100;
      // De-prorate to a full-year operating net, then split over 12 months
      const fullYearBenefit = (d.benefits / frac) * ramp;
      const fullYearRecurring = d.recurringCosts / frac; // negative
      return (fullYearBenefit + fullYearRecurring) / 12;
    });

    let breakEvenMonths = 999;
    let cum = -oneTimeCost; // one-time cost paid up front
    if (cum >= 0 && monthlyNet.some(v => v !== 0)) breakEvenMonths = implPeriod;
    for (let m = 1; m <= 60 && breakEvenMonths === 999; m++) {
      const yearIdx = Math.ceil(m / 12) - 1;
      if (m > implPeriod) cum += monthlyNet[yearIdx] ?? 0;
      if (cum >= 0 && (monthlyNet[yearIdx] ?? 0) > 0) breakEvenMonths = m;
    }
    if (breakEvenMonths === 999) breakEvenMonths = accum >= 0 ? implPeriod : 999;

    return {
      totalSavings: Math.round(accum),
      breakEvenMonths,
      y4NetSavings: rows[3]?.netSavings ?? null,
    };
  }, [businessCaseResult, aipipRampPcts, baseliningData.implementationPeriod]);

  // Fire onValuesChange whenever AIPIP summary values change
  React.useEffect(() => {
    if (!onValuesChange || isBaselineMode) return; // AIPIP path only
    const roi = summaryValues.roi !== 'N/A' ? parseFloat(summaryValues.roi) : null;
    const totalSavings = rampedSummary?.totalSavings ?? summaryValues.benefits;
    const npv = totalSavings;
    onValuesChange({
      roi,
      npv,
      benefits: summaryValues.benefits,
      oneTime: summaryValues.oneTime,
      runY5: summaryValues.recurringPerYear * 5,
      totalSavings,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryValues, rampedSummary, isBaselineMode]);

  // ── AI PR Creation annual model (derived from custom baseline cards) ─────────
  const PR_YEARS = ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
  const prModel = React.useMemo(() => {
    const num = (k: string) => parseNumber(customBaseline[k] || '');
    const pct = (k: string) => num(k) / 100;

    // Placeholder unit processing costs (€ per transaction step) — replace when full cost logic is wired
    const U = { prCreate: 15, prReview: 8, prMod: 12, poCreate: 15, poReview: 8, poMod: 12, asn: 5, exception: 20, invoice: 6 };

    const numberOfPRs = num('numberOfPRs');
    const modifiedPRs = num('modifiedPRs');
    const numberOfPOs = num('numberOfPOs');
    const modifiedPOs = num('modifiedPOs');
    const numberOfASN = num('numberOfASN');
    const numberOfExceptions = num('numberOfExceptions');
    const numberOfInvoices = num('numberOfInvoices');

    const fteCostPerYear = num('fteCostPerYear');
    const volFor: Record<string, number> = {
      numberOfPRs, modifiedPRs, numberOfPOs, modifiedPOs, numberOfASN, numberOfExceptions, numberOfInvoices,
    };

    // Per-process-step definitions (drives both the annual model and the Value Deep Dive table)
    const stepDefs = [
      { process: 'Purchase Requisition', l2: '1.1', name: 'Create Requisition', volKey: 'numberOfPRs', unit: U.prCreate, impactKey: 'impactPRCreation', influence: 'High', desc: 'Automated / assisted requisition creation', asIs: 15 },
      { process: 'Purchase Requisition', l2: '1.2', name: 'Review & Approve Requisition', volKey: 'numberOfPRs', unit: U.prReview, impactKey: 'impactPRReviewReduction', influence: 'Medium', desc: 'AI-supported review and approval routing', asIs: 10 },
      { process: 'Purchase Requisition', l2: '1.3', name: 'Modify or Cancel Requisition', volKey: 'modifiedPRs', unit: U.prMod, impactKey: 'impactPRModification', modReducKey: 'prModificationReduction', influence: 'Medium', desc: 'Reduced rework via higher first-time quality', asIs: 10 },
      { process: 'Purchase Order', l2: '2.1', name: 'Create Purchase Order', volKey: 'numberOfPOs', unit: U.poCreate, impactKey: 'impactPOCreationReduction', influence: 'Medium', desc: 'Automated PO creation from requisition', asIs: 20 },
      { process: 'Purchase Order', l2: '2.2', name: 'Review, Approve & Distribute Purchase Order', volKey: 'numberOfPOs', unit: U.poReview, impactKey: 'impactPOReviewReduction', influence: 'Low', desc: 'Streamlined PO review and distribution', asIs: 15 },
      { process: 'Purchase Order', l2: '2.4', name: 'Modify or Cancel Purchase Order', volKey: 'modifiedPOs', unit: U.poMod, impactKey: 'impactPOModification', modReducKey: 'poModificationReduction', influence: 'Low', desc: 'Reduced PO changes and cancellations', asIs: 10 },
      { process: 'Goods/Service Receipt', l2: '3.2', name: 'Accept/refuse & record receipt of goods/service', volKey: 'numberOfASN', unit: U.asn, impactKey: 'impactAcceptRefuseReceipt', influence: 'Low', desc: 'Automated goods/service receipt matching', asIs: 20 },
      { process: 'Goods/Service Receipt', l2: '3.3', name: 'Research/resolve exceptions', volKey: 'numberOfExceptions', unit: U.exception, impactKey: 'impactResearchResolveExceptions', influence: 'Medium', desc: 'AI-assisted exception research and resolution', asIs: 5 },
      { process: 'Invoice Processing', l2: '4.2', name: 'Validate, Approve & Post Invoices / Credit Notes', volKey: 'numberOfInvoices', unit: U.invoice, impactKey: 'impactInvoiceValidationReduction', influence: 'Medium', desc: 'Automated invoice validation and posting', asIs: 15 },
    ] as const;

    const descByL2: Record<string, string> = Object.fromEntries(stepDefs.map(s => [s.l2, s.desc]));

    type Step = {
      process: string; l2: string; name: string; influence: string; desc: string;
      improvement: number; fteBaseline: number; asIs: number; withAI: number; ftePotential: number;
      efficiency: number; carryOver: number | null; material: number | null; overall: number;
    };

    const preset = deepDiveDefaults?.[selectedScenario];
    let steps: Step[];
    if (preset && preset.length) {
      // Explicit per-scenario values loaded on scenario switch
      steps = preset.map(r => ({
        process: r.process,
        l2: r.l2,
        name: r.name,
        influence: r.influence,
        desc: r.desc ?? descByL2[r.l2] ?? '',
        improvement: r.improvement,
        fteBaseline: r.fteBaseline,
        asIs: r.asIs,
        withAI: r.withAI,
        ftePotential: r.ftePotential,
        efficiency: r.efficiency,
        carryOver: r.carryOver,
        material: r.material,
        overall: r.overall,
      }));
    } else {
      // Derived from Client Baselining (e.g. "Custom" scenario)
      steps = stepDefs.map(s => {
        const vol = volFor[s.volKey] ?? 0;
        const impact = pct(s.impactKey);
        const improvementFrac = 'modReducKey' in s && s.modReducKey
          ? (pct(s.modReducKey) + (1 - pct(s.modReducKey)) * impact)
          : impact;
        const efficiency = vol * s.unit * improvementFrac;
        const fteBaseline = fteCostPerYear > 0 ? (vol * s.unit) / fteCostPerYear : 0;
        const ftePotential = fteBaseline * improvementFrac;
        const carryOver = efficiency * 0.10;
        const material: number | null = null; // procurement-level driver — not attributable per step
        const overall = efficiency + carryOver + (material ?? 0);
        const withAI = Math.min(100, s.asIs + improvementFrac * 100);
        return {
          process: s.process, l2: s.l2, name: s.name, influence: s.influence, desc: s.desc,
          improvement: improvementFrac * 100, fteBaseline, asIs: s.asIs, withAI, ftePotential,
          efficiency, carryOver, material, overall,
        };
      });
    }

    const processEfficiencyAnnual = steps.reduce((sum, s) => sum + s.efficiency, 0);
    const carryOverAnnual = steps.reduce((sum, s) => sum + (s.carryOver ?? 0), 0);
    const materialCostAnnual = steps.reduce((sum, s) => sum + (s.material ?? 0), 0);

    // Benefit ramp — 2026 is the implementation year (0%), 2027–2031 ramp up gradually
    const benefitRamp = [0, 1, 1, 1, 1, 1];
    const rampSum = benefitRamp.reduce((a, b) => a + b, 0);
    const PR_RAMP = prRampPcts.map(v => v / 100);
    const discountRate = 0.08;

    // Per-scenario Annual View defaults anchor the 5Y benefit totals; "Custom" computes bottom-up.
    const ad = annualDefaults?.[selectedScenario];
    const pe5 = ad ? ad.processEfficiency : processEfficiencyAnnual * rampSum;
    const co5 = ad ? ad.carryOver : carryOverAnnual * rampSum;
    const mc5 = ad ? ad.material : materialCostAnnual * rampSum;
    const totalBenefits5Y = ad ? ad.totalBenefits : pe5 + co5 + mc5;

    // Costs driven by the Fees section values.
    const oneTimeCost = parseNumber(prFeesData.projectFees);
    const runningCostPerYear = parseNumber(prFeesData.infrastructureHosting)
      + parseNumber(prFeesData.supportFees)
      + parseNumber(prFeesData.aiConsumption)
      + parseNumber(prFeesData.feePerPR) * numberOfPRs;
    const runningCost5Y = runningCostPerYear * 5;
    const totalCost5Y = oneTimeCost + runningCost5Y;

    // Distribute benefits (by ramp) and costs (one-time in 2026, running spread over operational years)
    let cumNet = 0, cumNpv = 0;
    const rows = PR_YEARS.map((year, i) => {
      const w = rampSum > 0 ? benefitRamp[i] / rampSum : 0;
      const pe = pe5 * w;
      const co = co5 * w;
      const mc = mc5 * w;
      const totalBenefits = pe + co + mc;
      const rampPct = PR_RAMP[i];
      const adjustedTotalBenefits = totalBenefits * rampPct;
      const oneTime = i === 0 ? oneTimeCost : 0;
      const running = i === 0 ? 0 : runningCostPerYear;
      const investment = oneTime + running;
      const netBenefits = adjustedTotalBenefits - investment;
      const npv = netBenefits / Math.pow(1 + discountRate, i);
      cumNet += netBenefits;
      cumNpv += npv;
      return { year, pe, co, mc, totalBenefits, rampPct, adjustedTotalBenefits, oneTime, running, investment, netBenefits, cumNet, npv, cumNpv };
    });

    const adjustedTotalBenefits5Y = rows.reduce((s, r) => s + r.adjustedTotalBenefits, 0);
    const netBenefits5Y = adjustedTotalBenefits5Y - totalCost5Y;
    const finalCumNpv = cumNpv;
    const roiX = totalCost5Y > 0 ? netBenefits5Y / totalCost5Y : null;
    const fteReduction = steps.reduce((sum, s) => sum + s.ftePotential, 0);

    return { rows, steps, totalBenefits5Y, adjustedTotalBenefits5Y, totalCost5Y, oneTimeCost, runningCost5Y, netBenefits5Y, finalCumNpv, roiX, fteReduction };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customBaseline, selectedScenario, prPhaseCosts, prFeesData, prRampPcts]);

  // AIPIP-specific 5Y benefit total — mirrors what the Value Deep Dive section displays.
  // For AIPIP (!baselineCards), benefits come from baseliningData, not from prModel.steps.
  const aipipBenefits5Y = React.useMemo(() => {
    if (baselineCards) return 0; // PR Creation / SCC use prModel path
    const invoicesNum = parseNumber(baseliningData.invoicesPerYear);
    const ftesNum = parseNumber(baseliningData.totalFTEs);
    const costPerFteNum = parseNumber(baseliningData.costPerFTE) * (1 + parseNumber(baseliningData.overheadPct) / 100);
    const feePerInvoiceNum = parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice;
    const infraNum = parseNumber(feesData.infrastructureHosting);
    const supportNum = parseNumber(feesData.supportFees);
    const currentToolNum = invoicesNum * parseNumber(baseliningData.currentOcrCostPerInvoice);
    const efficiencyGains = (netEfficiencyGainsPct ?? 0) / 100;
    const costPerInvoice = invoicesNum > 0 && ftesNum > 0 ? (ftesNum * costPerFteNum) / invoicesNum : 0;
    const avgSavingsPerInvoice = costPerInvoice > 0 ? costPerInvoice * efficiencyGains - feePerInvoiceNum : 0;
    const netBenefitsPerYear = avgSavingsPerInvoice > 0 && invoicesNum > 0
      ? avgSavingsPerInvoice * invoicesNum - (infraNum + supportNum) + currentToolNum
      : 0;
    return netBenefitsPerYear > 0 ? netBenefitsPerYear * 5 : 0;
  }, [baselineCards, baseliningData, feesData, phaseCosts.ocrCostPerInvoice, netEfficiencyGainsPct]);

  // Value Driver Breakdown 5Y totals (mirrors the on-screen breakdown) — used when saving the case
  const valueDriverTotals = React.useMemo(() => {
    const out: Record<string, number> = {};

    if (!baselineCards) {
      // AIPIP path: the active 'pe'-sourced driver ("Automation-driven cost savings") always
      // equals the headline Total 5Y Savings (rampedSummary is in k€ → convert to €).
      const total5YSavings = (rampedSummary?.totalSavings ?? 0) * 1000;
      valueDriverBreakdown.forEach(d => {
        if (d.active) out[d.name] = d.source === 'pe' ? total5YSavings : 0;
      });
    } else {
      // baselineCards path (AI PR Creation, SCC): derive from prModel steps
      const vdDefaults = valueDriverDefaults?.[selectedScenario];
      const presetRows = deepDiveDefaults?.[selectedScenario] ?? [];
      const sumEff = (arr: { efficiency: number }[]) => arr.reduce((s, x) => s + (x.efficiency ?? 0), 0);
      const sumCo = (arr: { carryOver: number | null }[]) => arr.reduce((s, x) => s + (x.carryOver ?? 0), 0);
      const sumMat = (arr: { material: number | null }[]) => arr.reduce((s, x) => s + (x.material ?? 0), 0);
      const scaleTo = (cur: number, base: number, total: number) => (base !== 0 ? total * (cur / base) : cur * 5);
      const vdPe = vdDefaults ? scaleTo(sumEff(prModel.steps), sumEff(presetRows), vdDefaults.processEfficiency) : sumEff(prModel.steps) * 5;
      const vdCo = vdDefaults ? scaleTo(sumCo(prModel.steps), sumCo(presetRows), vdDefaults.carryOver) : sumCo(prModel.steps) * 5;
      const vdMat = vdDefaults ? scaleTo(sumMat(prModel.steps), sumMat(presetRows), vdDefaults.material) : sumMat(prModel.steps) * 5;
      const vdTotal = vdPe + vdCo + vdMat;
      const src = (s?: string) => s === 'pe' ? vdPe : s === 'co' ? vdCo : s === 'mat' ? vdMat : s === 'total' ? vdTotal : 0;
      valueDriverBreakdown.forEach(d => { if (d.active) out[d.name] = src(d.source); });
    }

    // Attribute totals across every selected Level 3 sub-process (split evenly) so they land in
    // the correct Deep Dive rows. Only selected sub-processes participate in the calculation.
    const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bySubprocess: Record<string, Record<string, number>> = {};
    if (selectedCaseL3s.length > 0) {
      const share = 1 / selectedCaseL3s.length;
      selectedCaseL3s.forEach(l3 => {
        bySubprocess[normKey(l3)] = Object.fromEntries(
          Object.entries(out).map(([k, v]) => [k, v * share]),
        );
      });
    }
    return { out, bySubprocess };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prModel, selectedScenario, valueDriverBreakdown, valueDriverDefaults, deepDiveDefaults, selectedCaseL3Key, baselineCards, aipipBenefits5Y, rampedSummary]);

  const handleSaveCase = () => {
    saveCaseDrivers(useCaseId, summaryTitle || title, valueDriverTotals.out, valueDriverTotals.bySubprocess);
    saveCaseInputs(useCaseId, {
      selectedSubProcesses,
      caseSubProcs,
      selectedModels,
      baseliningData,
      customBaseline,
      scenarios,
      selectedScenario,
      prRampPcts,
      aipipRampPcts,
      phaseCosts,
      prPhaseCosts,
      feesData,
      prFeesData,
    });
    setCaseSavedFlash(true);
    setTimeout(() => setCaseSavedFlash(false), 1800);
  };

  // Fire onValuesChange for AI PR Creation path
  React.useEffect(() => {
    if (!onValuesChange || !isBaselineMode) return;
    const roi = prModel.roiX !== null ? prModel.roiX * 100 : null;
    onValuesChange({
      roi,
      npv: Math.round(prModel.finalCumNpv / 1000),
      benefits: Math.round(prModel.adjustedTotalBenefits5Y / 1000),
      oneTime: Math.round(prModel.oneTimeCost / 1000),
      runY5: Math.round(prModel.runningCost5Y / 1000),
      totalSavings: Math.round(prModel.netBenefits5Y / 1000),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prModel, isBaselineMode]);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <BusinessCaseLogicModal open={showLogicModal} onClose={() => setShowLogicModal(false)} />
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#00338D] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Back to Business Case Simulation</span>
          </button>
        )}

        {/* Header */}
        <div className="border border-gray-300 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-4 py-3 flex items-center gap-3">
            <Package size={20} />
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="text-xs text-blue-100">{subtitle}</p>
            </div>
            {(() => {
              const isSaved = !!savedCaseDrivers[useCaseId];
              return (
                <button
                  type="button"
                  onClick={handleSaveCase}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border transition-all duration-200 ${
                    caseSavedFlash
                      ? 'bg-green-500 border-green-400 text-white'
                      : isSaved
                        ? 'bg-green-50 border-green-500 text-green-700 hover:bg-green-100'
                        : 'bg-white text-[#00338D] border-white hover:bg-[#00A3E0]/10'
                  }`}
                >
                  {caseSavedFlash
                    ? <><Check size={14} /> Case Saved</>
                    : isSaved
                      ? <><Check size={14} /> Saved — Update</>
                      : <><Save size={14} /> Save Case</>}
                </button>
              );
            })()}
          </div>
        </div>

        {/* Use Case Summary */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
            <span>Use Case Summary</span>
            {baselineCards && (
              <button
                onClick={() => setShowLogicModal(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-white/40 bg-white text-[#00338D] text-[11px] font-medium hover:bg-[#00A3E0]/10 transition-colors"
              >
                <HelpCircle size={13} className="text-[#00A3E0]" />
                <span>How is this business case calculated?</span>
              </button>
            )}
          </div>
          <div className="p-4">
            {baselineCards ? (() => {
              const fmtKpi = (n: number) => {
                const abs = Math.abs(n);
                const sign = n < 0 ? '-' : '';
                if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
                if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(0)}k`;
                return `${sign}€${Math.round(abs)}`;
              };
              const kpis = [
                { label: 'ROI (5Y)', value: prModel.roiX !== null ? `${(prModel.roiX * 100).toFixed(0)}%` : 'N/A', negative: false },
                { label: 'Cum. NPV (5Y)', value: fmtKpi(prModel.finalCumNpv), negative: prModel.finalCumNpv < 0 },
                { label: 'Total Benefits', value: fmtKpi(prModel.adjustedTotalBenefits5Y), negative: false },
                { label: 'Total Cost', value: fmtKpi(prModel.totalCost5Y), negative: false },
                { label: 'One-Time Cost', value: fmtKpi(prModel.oneTimeCost), negative: false },
                { label: 'Running Cost (5Y)', value: fmtKpi(prModel.runningCost5Y), negative: false },
              ];
              return (
                <>
                  <div className="grid grid-cols-6 gap-3 text-center">
                    {kpis.map(k => (
                      <div key={k.label} className="border border-gray-200 rounded bg-gray-50 p-3">
                        <div className="text-xs text-gray-600 mb-1">{k.label}</div>
                        <div className={`text-lg font-bold ${k.negative ? 'text-red-600' : 'text-[#00338D]'}`}>{k.value}</div>
                      </div>
                    ))}
                  </div>
                  {(summaryTitle || summaryDescription) && (
                    <div className="mt-4">
                          {summaryDescription && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{summaryDescription}</p>}
                    </div>
                  )}
                </>
              );
            })() : (
            <>
            <div className="grid grid-cols-7 gap-3 text-center">
              {/* ROI */}
              {/* 1 — Net Efficiency Gains */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">Net Efficiency Gains</div>
                <div className="text-xl font-bold text-[#00338D]">
                  {netEfficiencyGainsPct !== null ? `${netEfficiencyGainsPct.toFixed(2)}%` : '—'}
                </div>
              </div>

              {/* 2 — Break-even */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">Break-even</div>
                {(() => {
                  const bem = rampedSummary?.breakEvenMonths ?? summaryValues.breakEvenMonths;
                  return (
                    <div className={`text-xl font-bold ${
                      bem <= 18 ? 'text-green-600' :
                      bem <= 30 ? 'text-orange-500' :
                      bem <= 66 ? 'text-red-600' :
                      'text-gray-400'
                    }`}>
                      {bem > 66 ? '> 66m' : `${bem}m`}
                    </div>
                  );
                })()}
                <div className="text-[8px] text-gray-500 mt-0.5">
                  {(() => {
                    const impl = baseliningData.implementationPeriod.trim() !== '' ? parseNumber(baseliningData.implementationPeriod) : 6;
                    return impl === 0 ? 'From go live' : `incl. ${impl}m project time`;
                  })()}
                </div>
              </div>

              {/* 3 — Net Savings per Year (Year 4) */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">Net Savings / Year</div>
                <div className="text-xl font-bold text-[#00338D]">
                  {(() => {
                    const y4 = rampedSummary?.y4NetSavings ?? businessCaseResult?.data[3]?.netSavings;
                    if (y4 == null) return '—';
                    const abs = Math.abs(y4);
                    const sign = y4 < 0 ? '-' : '';
                    return abs >= 1000
                      ? `${sign}€${(abs / 1000).toFixed(2)}M`
                      : `${sign}€${abs}k`;
                  })()}
                </div>
                <div className="text-[8px] text-gray-500 mt-0.5">Year 4</div>
              </div>

              {/* 4 — Total 5Y Savings */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">Total 5Y Savings</div>
                <div className={`text-xl font-bold ${
                  !rampedSummary ? 'text-[#00338D]' :
                  rampedSummary.totalSavings < 0 ? 'text-red-600' : 'text-[#00338D]'
                }`}>
                  {rampedSummary ? (() => {
                    const s = rampedSummary.totalSavings;
                    const abs = Math.abs(s);
                    const sign = s < 0 ? '-' : '';
                    return `${sign}€${(abs / 1000).toFixed(2)}M`;
                  })() : '€0.00M'}
                </div>
              </div>

              {/* 5 — FTE Reduction */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">FTE Reduction</div>
                <div className="text-xl font-bold text-[#00338D]">
                  {(() => {
                    const eff = (netEfficiencyGainsPct ?? 0) / 100;
                    const ftes = parseNumber(baseliningData.totalFTEs);
                    if (!ftes) return '—';
                    return (eff * ftes).toFixed(1);
                  })()}
                </div>
              </div>

              {/* 6 — ROI (5Y) */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">ROI (5Y)</div>
                <div className="text-xl font-bold text-[#00338D]">
                  {summaryValues.roi === 'N/A' ? 'N/A' : `${summaryValues.roi}%`}
                </div>
              </div>

              {/* 7 — One-Time Cost */}
              <div className="border border-gray-200 rounded bg-gray-50 p-3">
                <div className="text-xs text-gray-600 mb-1">One-Time Cost</div>
                <div className="text-xl font-bold text-[#00338D]">
                  {summaryValues.oneTime >= 1000
                    ? `€${(summaryValues.oneTime / 1000).toFixed(2)}M`
                    : `€${summaryValues.oneTime}k`}
                </div>
              </div>
            </div>
            {(summaryTitle || summaryDescription) && (
              <div className="mt-4">
                {summaryDescription && <p className="text-xs text-gray-600 mt-1 leading-relaxed">{summaryDescription}</p>}
              </div>
            )}
            </>
            )}
          </div>
        </div>

        {/* Business Case Chart */}
        {baselineCards ? (() => {
          const fmt = (n: number) => {
            const abs = Math.abs(n);
            const sign = n < 0 ? '-' : '';
            if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
            if (abs >= 1000) return `${sign}€${(abs / 1000).toFixed(0)}k`;
            return `${sign}€${Math.round(abs)}`;
          };
          const tableRows: { label: string; get: (r: typeof prModel.rows[0]) => number; bold?: boolean; invest?: boolean; accent?: boolean; isRamp?: boolean }[] = [
            { label: annualEfficiencyLabel, get: r => r.pe },
            { label: 'Carry-over Effect', get: r => r.co },
            { label: 'Material Cost Reduction', get: r => r.mc },
            { label: 'Total Benefits', get: r => r.totalBenefits, bold: true },
            { label: 'Ramp-up (%)', get: r => r.rampPct, isRamp: true },
            { label: 'Adjusted Total Benefits', get: r => r.adjustedTotalBenefits, bold: true, accent: false },
            { label: 'One-Time Cost', get: r => -r.oneTime, invest: true },
            { label: 'Running Cost', get: r => -r.running, invest: true },
            { label: 'Net Benefits', get: r => r.netBenefits, bold: true },
            { label: 'Cum. Net Benefits', get: r => r.cumNet },
            { label: 'Net Present Value', get: r => r.npv },
            { label: 'Cum. NPV', get: r => r.cumNpv, bold: true, accent: true },
          ];
          return (
            <div className="border border-gray-200 rounded bg-white shadow-sm">
              <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">
                Business Case (annual view)
              </div>
              {/* Chart */}
              {(() => {
                const allFilled = baselineCards.every(c =>
                  c.fields.every(f => (customBaseline[f.key] ?? '').trim() !== ''));
                const chartData = prModel.rows.map((r, i) => ({
                  yearNum: i + 1,
                  year: `${r.year}`,
                  oneTimeCosts: -Math.round(r.oneTime / 1000),
                  runningCosts: -Math.round(r.running / 1000),
                  benefits: Math.round(r.adjustedTotalBenefits / 1000),
                  netSavings: Math.round(r.netBenefits / 1000),
                  netSavingsAccumulated: Math.round(r.cumNet / 1000),
                }));
                const allValues = chartData.flatMap(d => [d.netSavings, d.netSavingsAccumulated, d.oneTimeCosts, d.runningCosts, d.benefits]);
                const dataMin = Math.min(...allValues, 0);
                const dataMax = Math.max(...allValues, 0);
                const yMin = Math.floor(dataMin / 500) * 500 - 500;
                const yMax = Math.ceil(dataMax / 1000) * 1000 + 1000;

                return (
                  <div className="border-t border-gray-200 p-4" style={{ height: 440 }}>
                    {!allFilled ? (
                      <div className="h-full flex items-center justify-center text-center">
                        <div className="text-xs text-gray-500 max-w-xs">
                          Select a scenario and complete all Client Baselining fields to generate the chart
                        </div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                          data={chartData}
                          margin={{ top: 20, right: 30, bottom: 20, left: 60 }}
                          barGap={2}
                          barCategoryGap="20%"
                        >
                          <defs>
                            <pattern id="prRedHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                              <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#ef4444" strokeWidth="1" />
                            </pattern>
                          </defs>
                          <ReferenceArea key="pr-ref-neg" y1={yMin} y2={0} fill="#fee2e2" fillOpacity={0.3} />
                          <ReferenceArea key="pr-ref-pos" y1={0} y2={yMax} fill="#dcfce7" fillOpacity={0.3} />
                          <ReferenceLine key="pr-ref-zero" y={0} stroke="#000" strokeWidth={2} />
                          <CartesianGrid key="pr-grid" strokeDasharray="3 3" />
                          <XAxis
                            key="pr-xaxis"
                            dataKey="yearNum"
                            type="number"
                            domain={[0.5, 6.5]}
                            ticks={[1, 2, 3, 4, 5, 6]}
                            tickFormatter={(v: number) => `${PR_YEARS[v - 1]}`}
                            tick={{ fontSize: 12 }}
                            interval={0}
                          />
                          <YAxis
                            key="pr-yaxis"
                            domain={[yMin, yMax]}
                            tick={{ fontSize: 12 }}
                            tickFormatter={v => {
                              const absV = Math.abs(v);
                              const sign = v < 0 ? '-' : '';
                              if (absV >= 1000) return `${sign}${(absV / 1000).toFixed(1)}M€`;
                              return `${sign}${absV}k€`;
                            }}
                            label={{ value: 'Costs / Savings', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                          />
                          <Tooltip
                            key="pr-tooltip"
                            content={({ active, payload, label }) => {
                              if (!active || !payload?.length) return null;
                              const COLOR_MAP: Record<string, string> = {
                                'One-time cost': '#ef4444',
                                'Running cost': '#1e40af',
                                'Total Benefits': '#4FC3F7',
                                'Net Benefits': '#22c55e',
                                'Cum. Net Benefits': '#f97316',
                              };
                              const fmtT = (v: number) => {
                                const absV = Math.abs(v);
                                const sign = v < 0 ? '-' : '';
                                return absV >= 1000 ? `${sign}€${(absV / 1000).toFixed(2)}M` : `${sign}€${absV}k`;
                              };
                              return (
                                <div className="bg-white border border-gray-200 rounded shadow-lg px-3 py-2 text-[11px] space-y-1">
                                  <div className="font-semibold text-gray-600 mb-1">{PR_YEARS[(label as number) - 1] ?? label}</div>
                                  {payload.map((entry: any) => {
                                    const color = entry.name === 'Net Benefits' && entry.value < 0 ? '#ef4444' : COLOR_MAP[entry.name] ?? entry.color;
                                    return (
                                      <div key={entry.name} className="flex items-center justify-between gap-4">
                                        <span style={{ color }} className="font-medium">{entry.name}</span>
                                        <span style={{ color }} className="font-semibold">{fmtT(entry.value)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            }}
                          />
                          <Legend key="pr-legend" wrapperStyle={{ fontSize: 11 }} />
                          <Bar key="pr-bar-onetime" dataKey="oneTimeCosts" name="One-time cost" fill="#ef4444" barSize={24} legendType="rect" isAnimationActive={false} />
                          <Bar key="pr-bar-running" dataKey="runningCosts" name="Running cost" fill="#1e40af" barSize={24} legendType="rect" isAnimationActive={false} />
                          <Bar key="pr-bar-benefits" dataKey="benefits" name="Total Benefits" fill="#4FC3F7" barSize={24} legendType="rect" isAnimationActive={false} />
                          <Bar key="pr-bar-net" dataKey="netSavings" name="Net Benefits" barSize={24} legendType="rect" isAnimationActive={false}>
                            {chartData.map((entry, i) => (
                              <Cell key={`pr-ns-${i}`} fill={entry.netSavings < 0 ? '#ef4444' : '#22c55e'} />
                            ))}
                          </Bar>
                          <Line
                            key="pr-line-cum"
                            type="monotone"
                            dataKey="netSavingsAccumulated"
                            name="Cum. Net Benefits"
                            stroke="#f97316"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            dot={{ fill: '#f97316', r: 6, strokeWidth: 2, stroke: '#fff' }}
                            legendType="line"
                            isAnimationActive={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                );
              })()}

              {/* Toggle button */}
              <div className="px-4 pb-3 flex justify-end">
                <button
                  onClick={() => setShowPrTable(v => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {showPrTable ? 'Hide Calculation Table' : 'Show Calculation Table'}
                </button>
              </div>

              {/* Collapsible data table */}
              {showPrTable && (
                <div className="border-t border-gray-200 p-4 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500">
                        <th className="text-left px-3 py-2 font-medium">€ per year</th>
                        {PR_YEARS.map(y => (
                          <th key={y} className="text-right px-3 py-2 font-medium">{y}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map(row => (
                        <tr key={row.label} className={`border-b border-gray-100 ${row.bold ? 'bg-gray-50/60' : ''} ${row.isRamp ? 'bg-blue-50/40' : ''}`}>
                          <td className={`px-3 py-1.5 ${row.bold ? 'font-semibold text-gray-800' : row.isRamp ? 'text-gray-500 italic' : 'text-gray-700'}`}>{row.label}</td>
                          {prModel.rows.map((r, i) => {
                            const v = row.get(r);
                            if (row.isRamp) {
                              return (
                                <td key={r.year} className="px-3 py-1.5 text-right">
                                  {i === 0 ? (
                                    <span className="text-gray-300 italic">—</span>
                                  ) : (
                                    <div className="inline-flex items-center justify-end gap-0.5">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={prRampPcts[i]}
                                        onChange={e => setPrRampPcts(prev => { const next = [...prev]; next[i] = Number(e.target.value); return next; })}
                                        className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:border-[#00338D]"
                                      />
                                      <span className="text-gray-400 text-xs">%</span>
                                    </div>
                                  )}
                                </td>
                              );
                            }
                            const color = row.invest
                              ? 'text-red-600'
                              : row.accent
                                ? 'text-[#00338D]'
                                : v < 0 ? 'text-red-600' : 'text-gray-700';
                            return (
                              <td key={r.year} className={`px-3 py-1.5 text-right ${row.bold ? 'font-semibold' : ''} ${color}`}>
                                {v === 0 ? '—' : fmt(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[10px] text-gray-400 mt-2">
                    Values update when the scenario changes; manual edits in Client Baselining switch the status to "Custom".
                  </div>
                </div>
              )}
            </div>
          );
        })() : (
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
            <span>Business Case (annual view)</span>
            {businessCaseResult && (
              <div className="flex items-center gap-3">
                <span className="text-xs bg-green-600 px-2 py-1 rounded">
                  Efficiency: {parseFloat(businessCaseResult.percentage).toFixed(2)}%
                </span>
                <span className="text-xs">
                  Total 5Y savings: {(() => {
                    const s = rampedSummary?.totalSavings ?? businessCaseResult.totalSavings;
                    const abs = Math.abs(s);
                    const sign = s < 0 ? '-' : '';
                    return abs >= 1000
                      ? `${sign}€${(abs / 1000).toFixed(2)}M`
                      : `${sign}€${abs.toLocaleString()}k`;
                  })()}
                </span>
              </div>
            )}
          </div>
          <div className="p-6" style={{ height: 400 }}>
            {!businessCaseResult ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="text-xs text-gray-500 max-w-xs">
                  Complete baselining and fees to generate chart
                </div>
              </div>
            ) : (
              (() => {
                const visibleBarsCount = [
                  barVisibility.nonRecurring,
                  barVisibility.recurring,
                  barVisibility.benefits,
                  barVisibility.netSavings,
                ].filter(Boolean).length;
                const dynamicBarSize = visibleBarsCount <= 1 ? 50 : visibleBarsCount === 2 ? 35 : visibleBarsCount === 3 ? 28 : 22;

                // Apply editable ramp-up to chart data (data[i] = Year i+1, ramp index i+1)
                let rampAccum = 0;
                const rampedData = businessCaseResult.data.map((d, i) => {
                  const ramp = aipipRampPcts[i + 1] / 100;
                  const rampedBenefits = d.benefits * ramp;
                  const netSavings = rampedBenefits + d.recurringCosts + (d.nonRecurringCosts ?? 0);
                  rampAccum += netSavings;
                  return { ...d, benefits: Math.round(rampedBenefits), netSavings: Math.round(netSavings), netSavingsAccumulated: Math.round(rampAccum) };
                });

                // Dynamic Y-axis bounds from actual data
                const allValues = rampedData.flatMap(d => [
                  d.netSavings,
                  d.netSavingsAccumulated,
                  d.recurringCosts,
                  d.nonRecurringCosts ?? 0,
                  d.benefits,
                ]);
                const dataMin = Math.min(...allValues);
                const dataMax = Math.max(...allValues);
                const yMin = Math.floor(Math.min(dataMin, 0) / 500) * 500 - 500;
                const yMax = Math.ceil(Math.max(dataMax, 0) / 1000) * 1000 + 1000;

                return (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={rampedData}
                      margin={{ top: 20, right: 30, bottom: 20, left: 60 }}
                      barGap={2}
                      barCategoryGap="20%"
                    >
                      <defs>
                        <pattern id="redHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                          <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#ef4444" strokeWidth="1" />
                        </pattern>
                      </defs>

                      <ReferenceArea key="ref-area-negative" y1={yMin} y2={0} fill="#fee2e2" fillOpacity={0.3} />
                      <ReferenceArea key="ref-area-positive" y1={0} y2={yMax} fill="#dcfce7" fillOpacity={0.3} />
                      <ReferenceLine key="ref-line-zero" y={0} stroke="#000" strokeWidth={2} />

                      {/* Break-even line — exact fractional year position */}
                      {(rampedSummary?.breakEvenMonths ?? summaryValues.breakEvenMonths) <= 66 && (
                        <ReferenceLine
                          key="ref-line-breakeven"
                          x={(rampedSummary?.breakEvenMonths ?? summaryValues.breakEvenMonths) / 12}
                          stroke="#9333ea"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          label={{
                            value: `Break-even: ${rampedSummary?.breakEvenMonths ?? summaryValues.breakEvenMonths}m`,
                            position: 'top',
                            fill: '#9333ea',
                            fontSize: 10,
                            fontWeight: 'bold',
                          }}
                        />
                      )}

                      <CartesianGrid key="grid" strokeDasharray="3 3" />
                      <XAxis
                        key="xaxis"
                        dataKey="yearNum"
                        type="number"
                        domain={[0.5, 5.5]}
                        ticks={[1, 2, 3, 4, 5]}
                        tickFormatter={(v: number) => `Year ${v}`}
                        tick={{ fontSize: 12 }}
                        interval={0}
                      />
                      <YAxis
                        key="yaxis"
                        domain={[yMin, yMax]}
                        tick={{ fontSize: 12 }}
                        tickFormatter={v => {
                          const absV = Math.abs(v);
                          const sign = v < 0 ? '-' : '';
                          if (absV >= 1000) return `${sign}${(absV / 1000).toFixed(1)}M€`;
                          return `${sign}${absV}k€`;
                        }}
                        label={{ value: 'Costs / Savings', angle: -90, position: 'insideLeft', style: { fontSize: 12 } }}
                      />
                      <Tooltip
                        key="tooltip"
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const COLOR_MAP: Record<string, string> = {
                            'One-time cost': '#ef4444',
                            'Running cost':  '#1e40af',
                            'Benefits':            '#4FC3F7',
                            'Net Savings':         '#22c55e',
                            'Cumulative Savings':  '#f97316',
                          };
                          const fmt = (v: number) => {
                            const absV = Math.abs(v);
                            const sign = v < 0 ? '-' : '';
                            return absV >= 1000
                              ? `${sign}€${(absV / 1000).toFixed(2)}M`
                              : `${sign}€${absV}k`;
                          };
                          return (
                            <div className="bg-white border border-gray-200 rounded shadow-lg px-3 py-2 text-[11px] space-y-1">
                              <div className="font-semibold text-gray-600 mb-1">{label}</div>
                              {payload.map((entry: any) => {
                                const color = entry.name === 'Net Savings' && entry.value < 0
                                  ? '#ef4444'
                                  : COLOR_MAP[entry.name] ?? entry.color;
                                return (
                                  <div key={entry.name} className="flex items-center justify-between gap-4">
                                    <span style={{ color }} className="font-medium">{entry.name}</span>
                                    <span style={{ color }} className="font-semibold">{fmt(entry.value)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        }}
                      />
                      <Legend key="legend" wrapperStyle={{ fontSize: 11 }} />

                      {barVisibility.nonRecurring && (
                        <Bar
                          key="bar-nonRecurring"
                          dataKey="nonRecurringCosts"
                          name="One-time cost"
                          fill="url(#redHatch)"
                          barSize={dynamicBarSize}
                          legendType="rect"
                          id="bar-nonRecurring"
                        />
                      )}

                      {barVisibility.recurring && (
                        <Bar
                          key="bar-recurring"
                          dataKey="recurringCosts"
                          name="Running cost"
                          fill="#1e40af"
                          barSize={dynamicBarSize}
                          legendType="rect"
                          id="bar-recurring"
                        />
                      )}

                      {barVisibility.benefits && (
                        <Bar
                          key="bar-benefits"
                          dataKey="benefits"
                          name="Benefits"
                          fill="#4FC3F7"
                          barSize={dynamicBarSize}
                          legendType="rect"
                          id="bar-benefits"
                        />
                      )}

                      {barVisibility.netSavings && (
                        <Bar
                          key="bar-netSavings"
                          dataKey="netSavings"
                          name="Net Savings"
                          barSize={dynamicBarSize}
                          legendType="rect"
                          id="bar-netSavings"
                        >
                          {businessCaseResult.data.map((entry, i) => (
                            <Cell
                              key={`ns-${i}`}
                              fill={entry.netSavings < 0 ? '#ef4444' : '#22c55e'}
                            />
                          ))}
                        </Bar>
                      )}

                      <Line
                        key="line-cumulative"
                        type="monotone"
                        dataKey="netSavingsAccumulated"
                        name="Cumulative Savings"
                        stroke="#f97316"
                        strokeWidth={3}
                        strokeDasharray="5 5"
                        dot={{ fill: '#f97316', r: 6, strokeWidth: 2, stroke: '#fff' }}
                        legendType="line"
                        id="line-cumulative"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                );
              })()
            )}
          </div>

          {/* Toggle button */}
          <div className="px-4 pb-3 flex justify-end">
            <button
              onClick={() => setShowAipipTable(v => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-gray-300 bg-gray-50 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {showAipipTable ? 'Hide Calculation Table' : 'Show Calculation Table'}
            </button>
          </div>

          {/* Collapsible calculation table */}
          {showAipipTable && (() => {
            const YEARS = ['Year 0', 'Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5'];
            const RAMP  = aipipRampPcts.map(v => v / 100);
            const DISCOUNT = 0.10;

            const invoices       = parseNumber(baseliningData.invoicesPerYear);
            const ftes           = parseNumber(baseliningData.totalFTEs);
            const fteYearlyCost  = parseNumber(baseliningData.costPerFTE) * (1 + parseNumber(baseliningData.overheadPct) / 100);
            const efficiencyGains = (netEfficiencyGainsPct ?? 0) / 100;
            const processEffAnnual = efficiencyGains * ftes * fteYearlyCost;
            const invoiceFee      = parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice;
            const runningPerYear  = (invoices * invoiceFee)
              + parseNumber(feesData.infrastructureHosting)
              + parseNumber(feesData.supportFees);
            const oneTimeCostEur  = parseNumber(feesData.projectFees);
            const implPeriod      = Math.max(0, parseNumber(baseliningData.implementationPeriod) || 6);

            let cumNet = 0, cumNpv = 0;
            const yearRows = YEARS.map((yr, i) => {
              // Prorate by operational months in the year, matching the chart logic
              const operationalMonths = i === 0 ? 0 : Math.max(0, Math.min(12, i * 12 - implPeriod));
              const fraction      = operationalMonths / 12;
              const totalBenefits = processEffAnnual * fraction;
              const rampPct       = RAMP[i];
              const oneTime       = i === 0 ? oneTimeCostEur : 0;
              const running       = runningPerYear * fraction;
              const netBenefits   = (totalBenefits * rampPct) - oneTime - running;
              const npv           = netBenefits / Math.pow(1 + DISCOUNT, i);
              cumNet += netBenefits;
              cumNpv += npv;
              return { yr, totalBenefits, rampPct, oneTime, running, netBenefits, cumNet, npv, cumNpv };
            });

            type YRow = typeof yearRows[0];
            const fmtEur = (v: number) => {
              if (v === 0) return '—';
              const abs = Math.abs(v), sign = v < 0 ? '-' : '';
              if (abs >= 1_000_000) return `${sign}€${(abs / 1_000_000).toFixed(2)}M`;
              if (abs >= 1_000)     return `${sign}€${(abs / 1_000).toFixed(0)}k`;
              return `${sign}€${abs.toFixed(0)}`;
            };

            const tableRowDefs: Array<{
              label: string;
              get: (d: YRow) => number;
              bold?: boolean;
              isRamp?: boolean;
              invest?: boolean;
              accent?: boolean;
            }> = [
              { label: 'Process Efficiency Enhancement', get: d => d.totalBenefits },
              { label: 'Total Benefits',                 get: d => d.totalBenefits },
              { label: 'Ramp-up (%)',                    get: d => d.rampPct, isRamp: true },
              { label: 'One-Time Cost',                  get: d => -d.oneTime, invest: true },
              { label: 'Running Cost',                   get: d => -d.running, invest: true },
              { label: 'Net Benefits',                   get: d => d.netBenefits, bold: true },
              { label: 'Cum. Net Benefits',              get: d => d.cumNet },
              { label: 'Net Present Value (NPV)',        get: d => d.npv },
              { label: 'Cum. NPV',                       get: d => d.cumNpv, bold: true, accent: true },
            ];

            return (
              <div className="border-t border-gray-200 p-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2 font-medium">€ per year</th>
                      {YEARS.map(y => (
                        <th key={y} className="text-right px-3 py-2 font-medium">{y}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRowDefs.map(row => (
                      <tr key={row.label} className={`border-b border-gray-100 ${row.bold ? 'bg-gray-50/60' : ''} ${row.isRamp ? 'bg-blue-50/40' : ''}`}>
                        <td className={`px-3 py-1.5 ${row.bold ? 'font-semibold text-gray-800' : row.isRamp ? 'text-gray-500 italic' : 'text-gray-700'}`}>
                          {row.label}
                        </td>
                        {yearRows.map((d, i) => {
                          const v = row.get(d);
                          if (row.isRamp) {
                            return (
                              <td key={i} className="px-3 py-1.5 text-right">
                                {i === 0 ? (
                                  <span className="text-gray-300 italic">—</span>
                                ) : (
                                  <div className="inline-flex items-center justify-end gap-0.5">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={aipipRampPcts[i]}
                                      onChange={e => setAipipRampPcts(prev => { const next = [...prev]; next[i] = Number(e.target.value); return next; })}
                                      className="w-14 border border-gray-200 rounded px-1 py-0.5 text-right text-xs focus:outline-none focus:border-[#00338D]"
                                    />
                                    <span className="text-gray-400 text-xs">%</span>
                                  </div>
                                )}
                              </td>
                            );
                          }
                          // Year 0 has no benefits — suppress benefit rows only
                          if (i === 0 && row.label === 'Total Benefits') {
                            return <td key={i} className="px-3 py-1.5 text-right text-gray-300">—</td>;
                          }
                          const color = row.invest
                            ? 'text-red-600'
                            : row.accent
                              ? 'text-[#00338D]'
                              : v < 0 ? 'text-red-600' : 'text-gray-700';
                          return (
                            <td key={i} className={`px-3 py-1.5 text-right ${row.bold ? 'font-semibold' : ''} ${color}`}>
                              {fmtEur(v)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-[10px] text-gray-400 mt-2">
                  Discount rate: 10% · One-Time Cost in Year 0 · Ramp-up: 70% / 90% / 100%
                </div>
              </div>
            );
          })()}
        </div>
        )}

        {/* Chart Controls */}
        {businessCaseResult && (
          <div className="border border-gray-200 rounded bg-white">
          <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
            Chart Display Options
          </div>
          <div className="p-4">
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={barVisibility.nonRecurring}
                  onChange={() => toggleBarVisibility('nonRecurring')}
                  className="w-4 h-4 accent-red-600 cursor-pointer"
                />
                <span className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 bg-red-100 border border-red-400" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, #ef4444 0, #ef4444 1px, transparent 1px, transparent 4px)',
                  }}></span>
                  <span>One-time cost</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={barVisibility.recurring}
                  onChange={() => toggleBarVisibility('recurring')}
                  className="w-4 h-4 accent-blue-600 cursor-pointer"
                />
                <span className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 bg-[#1e40af] border border-gray-300"></span>
                  <span>Running cost</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={barVisibility.benefits}
                  onChange={() => toggleBarVisibility('benefits')}
                  className="w-4 h-4 accent-sky-400 cursor-pointer"
                />
                <span className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 bg-[#4FC3F7] border border-gray-300"></span>
                  <span>Benefits</span>
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={barVisibility.netSavings}
                  onChange={() => toggleBarVisibility('netSavings')}
                  className="w-4 h-4 accent-green-600 cursor-pointer"
                />
                <span className="flex items-center gap-2 text-xs">
                  <span className="w-4 h-4 bg-[#22c55e] border border-gray-300"></span>
                  <span>Net Savings</span>
                </span>
              </label>
            </div>
          </div>
          </div>
        )}

        {/* Scenario Overview */}
        {scenarioOverview && scenarioOverview.length > 0 && (
          <div className="border border-gray-200 rounded bg-white shadow-sm">
            <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">
              Scenario Overview
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-3">
                {scenarioOverview.map((sc, i) => (
                  <div key={i} className="border border-gray-200 rounded bg-gray-50 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="text-xs font-semibold text-[#00338D]">{sc.title}</div>
                      {sc.image && (
                        <span className="inline-flex items-center group">
                          <Info size={12} className="text-[#00A3E0] cursor-help" />
                          <span className="pointer-events-none fixed inset-0 z-50 hidden group-hover:flex items-center justify-center p-8">
                            <span className="absolute inset-0 bg-black/40" />
                            <span className="relative block bg-white rounded-lg shadow-2xl border border-gray-200 p-2">
                              <img src={sc.image} alt={sc.title} className="block max-w-[90vw] max-h-[85vh] w-auto h-auto rounded" />
                            </span>
                          </span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-600 leading-relaxed mb-2">{sc.description}</p>
                    <div className="flex flex-wrap gap-1">
                      {sc.tags.map(tag => (
                        <span key={tag} className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#00338D]/10 text-[#00338D]">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Client Baselining */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
        <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
          <span>Client Baselining</span>
          <div className="flex items-center gap-2">
            {/* Scenario selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowScenarioDropdown(prev => !prev)}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/15 text-white hover:bg-white/25 transition-all"
              >
                {selectedScenario}
                <ChevronDown size={10} />
              </button>
              {showScenarioDropdown && (
                <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-[180px]">
                  {scenarios.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleSelectScenario(s)}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                        s === selectedScenario
                          ? 'bg-[#00338D]/10 text-[#00338D] font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                  <div className="border-t border-gray-100">
                    {addingScenario ? (
                      <div className="px-2 py-2 flex items-center gap-1">
                        <input
                          autoFocus
                          type="text"
                          value={newScenarioName}
                          onChange={e => setNewScenarioName(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAddScenario(); if (e.key === 'Escape') { setAddingScenario(false); setNewScenarioName(''); } }}
                          placeholder="Scenario name"
                          className="flex-1 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:border-[#00338D]"
                        />
                        <button type="button" onClick={handleAddScenario}
                          className="text-[#00338D] hover:text-[#002C77] shrink-0">
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAddingScenario(true)}
                        className="w-full text-left px-3 py-2 text-xs text-[#00338D] hover:bg-[#00338D]/5 transition-colors font-medium"
                      >
                        + Add new scenario
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(baselineEditing || baselineCards) && (
              <button
                type="button"
                onClick={handleResetBaselining}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  baselineResetFlash ? 'bg-green-400 text-white' : 'bg-white/15 text-white hover:bg-white/25'
                }`}
              >
                <RotateCcw size={10} />
                {baselineResetFlash ? 'Reset!' : 'Reset to Default'}
              </button>
            )}
            {baselineEditing && (
              <button
                type="button"
                onClick={handleSaveBaselining}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all whitespace-nowrap ${
                  baselingSaveFlash ? 'bg-green-500 text-white' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {baselingSaveFlash
                  ? <><Check size={10} /> Saved!</>
                  : <><BookmarkCheck size={10} /> Save for {baseliningData.confidenceLevel}</>}
              </button>
            )}
            {!baselineCards && (
              <>
                <select
                  value={baseliningBenchmarkQuartile}
                  onChange={e => setBaseliningBenchmarkQuartile(e.target.value as 'Q25' | 'Q50' | 'Q75')}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-white/15 text-white border-0 focus:outline-none cursor-pointer"
                >
                  <option value="Q25" className="text-gray-800 bg-white">Q25</option>
                  <option value="Q50" className="text-gray-800 bg-white">Q50</option>
                  <option value="Q75" className="text-gray-800 bg-white">Q75</option>
                </select>
                <button
                  type="button"
                  onClick={() => setBaseliningBenchmarkOn(prev => !prev)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all ${
                    baseliningBenchmarkOn
                      ? 'bg-green-500 border-green-400 text-white'
                      : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
                  }`}
                >
                  {baseliningBenchmarkOn ? <><Check size={10} /> Benchmark: ON</> : 'Benchmark: OFF'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setBaselineEditing(prev => !prev)}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white/15 text-white hover:bg-white/25 transition-all"
              aria-label={baselineEditing ? 'Lock fields' : 'Edit fields'}
            >
              {baselineEditing ? <><Check size={10} /> Done</> : <><Pencil size={10} /> Edit</>}
            </button>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Applied Sub-Processes selector — multi-select L2 → L3, collapsible (hidden by default) */}
          <div className="border border-gray-200 rounded overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSubProcSelector(prev => !prev)}
              className="w-full bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-[#00338D] border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {showSubProcSelector ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                Applied Sub-Processes
              </span>
              <span className="text-[10px] font-normal text-gray-500">
                {selectedCaseL3s.length} sub-process{selectedCaseL3s.length === 1 ? '' : 'es'} selected
              </span>
            </button>
            {showSubProcSelector && (
              <div className="p-3 space-y-3">
                {Object.keys(l2l3Options).length === 0 && (
                  <p className="text-xs text-gray-400">No sub-processes available for the selected process scope.</p>
                )}
                {Object.keys(l2l3Options).map(l2 => {
                  const l3s = l2l3Options[l2] ?? [];
                  const selectedInL2 = caseSubProcs[l2] ?? [];
                  return (
                    <div key={l2} className="border border-gray-100 rounded">
                      <div className="bg-gray-50/70 px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 border-b border-gray-100 flex items-center justify-between">
                        <span>{l2}</span>
                        <span className="text-[10px] font-normal text-gray-400">
                          {selectedInL2.length} / {l3s.length}
                        </span>
                      </div>
                      <div className="p-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {l3s.map(l3 => {
                          const checked = selectedInL2.includes(l3);
                          return (
                            <label key={l3} className="flex items-start gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCaseL3(l2, l3)}
                                className="mt-0.5 accent-[#00338D]"
                              />
                              <span className={checked ? 'text-gray-700' : 'text-gray-400'}>{l3}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {baselineCards ? (() => {
            const ro = !baselineEditing;
            const inputCls = ro
              ? 'w-full border border-gray-200 bg-gray-50 rounded px-2 py-1 text-xs text-gray-700 h-7 cursor-default'
              : 'w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-400 h-7';
            const setField = (k: string, v: string) => setCustomBaseline(prev => ({ ...prev, [k]: v }));
            return (
              <div className="grid grid-cols-2 gap-4">
                {baselineCards.map(card => (
                  <div key={card.title} className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-[#00338D] border-b border-gray-200">
                      {card.title}
                    </div>
                    <table className="w-full text-xs">
                      <tbody>
                        {card.fields.map(f => {
                          const isPct = f.format === 'percent';
                          const isEur = f.format === 'euro';
                          return (
                            <tr key={f.key} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-1 text-gray-700 align-middle" style={{ width: '55%' }}>{f.label}</td>
                              <td className="px-3 py-1 align-middle">
                                <div className="relative">
                                  <input
                                    type="text"
                                    readOnly={ro}
                                    value={customBaseline[f.key] ?? ''}
                                    onChange={e => setField(f.key, e.target.value)}
                                    placeholder={ro ? '—' : 'Enter value'}
                                    className={`${inputCls} ${isPct ? 'pr-6' : ''} ${isEur ? 'pl-6' : ''}`}
                                  />
                                  {isPct && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>}
                                  {isEur && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            );
          })() : (() => {
            const ro = !baselineEditing;
            const inputCls = ro
              ? 'w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 text-xs text-gray-700 h-8 cursor-default'
              : 'w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400 h-8';
            const lbl = 'text-xs font-medium text-gray-700 h-8 flex items-end pb-1.5';
            return (
              <>
                {/* Row 1: Invoices | FTEs | Cost/FTE | Overhead | Implementation */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="flex flex-col">
                    <label className={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Invoices per year
                      {baseliningBenchmarkOn && benchmarkBaselining?.invoicesPerYear !== null && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 ml-1" title="Calculated from benchmark" />}
                    </label>
                    <input type="text" readOnly={ro || baseliningBenchmarkOn} value={baseliningData.invoicesPerYear}
                      onChange={e => setBaseliningsData(prev => ({ ...prev, invoicesPerYear: formatThousands(e.target.value) }))}
                      placeholder="Enter value"
                      className={`${baseliningBenchmarkOn ? 'w-full border border-green-300 bg-green-50 rounded px-2 py-1 text-xs text-green-700 font-semibold h-7 cursor-default' : inputCls}`} />
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      Total FTEs for invoicing
                      {(baseliningBenchmarkOn || invoiceFteLinked) && (
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full bg-green-400"
                          title={invoiceFteLinked ? 'Linked to Level 3 Client FTE (Validate, Approve, & Post Invoices / Credit Notes)' : 'Calculated from benchmark'}
                        />
                      )}
                    </label>
                    <input type="text" readOnly={ro || baseliningBenchmarkOn || invoiceFteLinked} value={baseliningData.totalFTEs}
                      onChange={e => setBaseliningsData(prev => ({ ...prev, totalFTEs: formatThousands(e.target.value) }))}
                      placeholder="Enter value"
                      className={`${(baseliningBenchmarkOn || invoiceFteLinked) ? 'w-full border border-green-300 bg-green-50 rounded px-2 py-1 text-xs text-green-700 font-semibold h-7 cursor-default' : inputCls}`} />
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl}>Cost per FTE/year</label>
                    <input type="text" readOnly={ro} value={baseliningData.costPerFTE}
                      onChange={e => setBaseliningsData(prev => ({ ...prev, costPerFTE: formatThousands(e.target.value) }))}
                      placeholder="Enter value" className={inputCls} />
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl}>Overhead (%)</label>
                    <div className="relative">
                      <input type="text" readOnly={ro} value={baseliningData.overheadPct}
                        onChange={e => setBaseliningsData(prev => ({ ...prev, overheadPct: e.target.value }))}
                        placeholder="e.g. 20" className={`${inputCls} pr-6`} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl}>Implementation period (months)</label>
                    <input type={ro ? 'text' : 'number'} readOnly={ro} min={0} value={baseliningData.implementationPeriod}
                      onChange={e => setBaseliningsData(prev => ({ ...prev, implementationPeriod: e.target.value }))}
                      placeholder="e.g. 6" className={inputCls} />
                  </div>
                </div>

                {/* Row 2: Confidence | Fully automated | Efficiency gain | OCR cost | OCR fees/yr */}
                <div className="grid grid-cols-5 gap-4">
                  <div className="flex flex-col">
                    <label className={lbl}>Confidence for dark processing</label>
                    <select value={baseliningData.confidenceLevel}
                      onChange={e => setBaseliningsData(prev => ({ ...prev, confidenceLevel: e.target.value }))}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400 h-8">
                      <option value="85%">85%</option>
                      <option value="90%">90%</option>
                      <option value="95%">95%</option>
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl}>Fully automated invoices (%)</label>
                    <div className="relative">
                      <input type="text" readOnly={ro} value={baseliningData.fullyAutomatedPct}
                        onChange={e => setBaseliningsData(prev => ({ ...prev, fullyAutomatedPct: e.target.value }))}
                        placeholder="Enter %" className={`${inputCls} pr-6`} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <label className={lbl}>Efficiency gain on remaining invoices (%)</label>
                    <div className="relative">
                      <input type="text" readOnly={ro} value={baseliningData.efficiencyGainRemainingPct}
                        onChange={e => setBaseliningsData(prev => ({ ...prev, efficiencyGainRemainingPct: e.target.value }))}
                        placeholder="Enter %" className={`${inputCls} pr-6`} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                    </div>
                  </div>

                  {/* Current OCR cost per invoice */}
                  <div className="flex flex-col">
                    <label className={lbl}>Current OCR cost per invoice</label>
                    <div className="relative">
                      <input type="text" readOnly={ro} value={baseliningData.currentOcrCostPerInvoice}
                        onChange={e => setBaseliningsData(prev => ({ ...prev, currentOcrCostPerInvoice: e.target.value }))}
                        placeholder="e.g. 0.25" className={`${inputCls} pr-6`} />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                    </div>
                  </div>

                  {/* Current OCR fees / year (calculated) */}
                  <div className="flex flex-col">
                    <label className={lbl}>Current OCR fees / year</label>
                    {(() => {
                      const inv = parseNumber(baseliningData.invoicesPerYear);
                      const ocrCost = parseNumber(baseliningData.currentOcrCostPerInvoice);
                      const yearly = inv * ocrCost;
                      return (
                        <div className="w-full border border-[#00A3E0]/40 bg-[#00A3E0]/5 rounded px-3 py-2 text-xs text-[#00338D] font-semibold h-8 flex items-center">
                          {yearly > 0 ? `€${yearly.toLocaleString('de-DE', { maximumFractionDigits: 0 })}` : '—'}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              </>
            );
          })()}
        </div>
        </div>

        {/* Fees */}
        {!baselineCards && (
        <div className="border border-gray-200 rounded bg-white shadow-sm">
        <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">
          Fees
        </div>
        <div className="p-4">
          <div className="grid grid-cols-5 gap-4">
            {[
              { key: 'projectFees', label: 'Project fees', prefix: '€' },
              { key: 'feePerInvoice', label: 'Fee per invoice', prefix: '€' },
              { key: 'infrastructureHosting', label: 'Infrastructure & hosting per year', prefix: '€' },
              { key: 'supportFees', label: 'Support fees per year', prefix: '€' },
            ].map(({ key, label, prefix }) => {
              const isSynced = tcoApplied && key === 'projectFees';
              const editing = editingFee[key] && !isSynced;
              const value = (feesData as any)[key] as string;
              const displayValue = value
                ? `${prefix}${Number(value).toLocaleString('de-DE')}`
                : '—';
              return (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                    {label}
                    {isSynced && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-normal">
                        <Check size={9} /> TCO synced
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    {editing ? (
                      <input
                        type="text"
                        autoFocus
                        value={value}
                        onChange={(e) => setFeesData(prev => ({ ...prev, [key]: formatThousands(e.target.value) }))}
                        onBlur={() => setEditingFee(prev => ({ ...prev, [key]: false }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') setEditingFee(prev => ({ ...prev, [key]: false }));
                        }}
                        className="w-full border border-[#00338D] rounded px-3 py-2 pr-9 text-xs focus:outline-none"
                      />
                    ) : (
                      <div className={`w-full border rounded px-3 py-2 pr-9 text-xs ${
                        isSynced
                          ? 'border-green-400 bg-green-50 text-green-800'
                          : 'border-gray-200 bg-gray-50 text-gray-700'
                      }`}>
                        {displayValue}
                      </div>
                    )}
                    {!isSynced && (
                      <button
                        type="button"
                        onClick={() => setEditingFee(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00338D]"
                        aria-label={editing ? 'Save' : 'Edit'}
                      >
                        {editing ? <Check size={12} /> : <Pencil size={12} />}
                      </button>
                    )}
                    {isSynced && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500">
                        <Check size={12} />
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* KPMG OCR cost per invoice — synced with phaseCosts.ocrCostPerInvoice */}
            {(() => {
              const isEditing = editingFee['kpmgOcrCostPerInvoice'];
              const rawVal = String(phaseCosts.ocrCostPerInvoice);
              const displayVal = phaseCosts.ocrCostPerInvoice > 0
                ? `€${phaseCosts.ocrCostPerInvoice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                : '—';
              return (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">KPMG OCR cost per invoice</label>
                  <div className="relative">
                    {isEditing ? (
                      <input
                        type="text"
                        autoFocus
                        value={phaseRawValue}
                        onChange={e => setPhaseRawValue(e.target.value)}
                        onBlur={() => {
                          setPhaseCosts(prev => ({ ...prev, ocrCostPerInvoice: parseNumber(phaseRawValue) }));
                          setEditingFee(prev => ({ ...prev, kpmgOcrCostPerInvoice: false }));
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            setPhaseCosts(prev => ({ ...prev, ocrCostPerInvoice: parseNumber(phaseRawValue) }));
                            setEditingFee(prev => ({ ...prev, kpmgOcrCostPerInvoice: false }));
                          }
                        }}
                        className="w-full border border-[#00338D] rounded px-3 py-2 pr-9 text-xs focus:outline-none"
                      />
                    ) : (
                      <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 pr-9 text-xs text-gray-700">
                        {displayVal}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setPhaseRawValue(rawVal);
                        setEditingFee(prev => ({ ...prev, kpmgOcrCostPerInvoice: !prev['kpmgOcrCostPerInvoice'] }));
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00338D]"
                      aria-label={isEditing ? 'Save' : 'Edit'}
                    >
                      {isEditing ? <Check size={12} /> : <Pencil size={12} />}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
        </div>
        )}

        {/* Fees — AI PR Creation */}
        {baselineCards && (
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
            <span>Fees</span>
            <button
              type="button"
              onClick={handleResetPrFees}
              className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                prFeesResetFlash ? 'bg-green-400 text-white' : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <RotateCcw size={10} />
              {prFeesResetFlash ? 'Reset!' : 'Reset to Default'}
            </button>
          </div>
          <div className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${feeFields.length}, minmax(0, 1fr))` }}>
              {feeFields.map(({ key, label, prefix = '€' }) => {
                const editing = prEditingFee[key as keyof typeof prEditingFee];
                const value = prFeesData[key as keyof typeof prFeesData];
                const displayValue = value ? `${prefix}${Number(value).toLocaleString('de-DE')}` : '—';
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">{label}</label>
                    <div className="relative">
                      {editing ? (
                        <input
                          type="text"
                          autoFocus
                          value={value}
                          onChange={(e) => setPrFeesData(prev => ({ ...prev, [key]: formatThousands(e.target.value) }))}
                          onBlur={() => setPrEditingFee(prev => ({ ...prev, [key]: false }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') setPrEditingFee(prev => ({ ...prev, [key]: false })); }}
                          className="w-full border border-[#00338D] rounded px-3 py-2 pr-9 text-xs focus:outline-none"
                        />
                      ) : (
                        <div className="w-full border border-gray-200 bg-gray-50 rounded px-3 py-2 pr-9 text-xs text-gray-700">
                          {displayValue}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setPrEditingFee(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#00338D]"
                        aria-label={editing ? 'Save' : 'Edit'}
                      >
                        {editing ? <Check size={12} /> : <Pencil size={12} />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Value Calculation */}
        {baselineCards ? (() => {
          const eur = (n: number) => `${n < 0 ? '-' : ''}€${Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
          const eurCell = (n: number | null) => (n === null || n === undefined) ? '—' : eur(n);
          const fmtPct = (n: number) => `${n.toFixed(n % 1 === 0 ? 0 : 1)}%`;
          const fmtNum = (n: number) => n.toFixed(n % 1 === 0 ? 1 : Math.min(3, (String(n).split('.')[1] || '').length));
          const negCls = (n: number | null) => (n !== null && n < 0) ? 'text-red-600' : '';
          const influenceStyle: Record<string, string> = {
            High: 'bg-[#00338D]/10 text-[#00338D]',
            Medium: 'bg-[#00A3E0]/10 text-[#00338D]',
            Low: 'bg-gray-100 text-gray-500',
            Direct: 'bg-[#00338D]/10 text-[#00338D]',
            Indirect: 'bg-gray-100 text-gray-500',
            'Direct / Indirect': 'bg-[#00A3E0]/10 text-[#00338D]',
          };
          const totals = prModel.steps.reduce(
            (a, s) => ({
              efficiency: a.efficiency + s.efficiency,
              carryOver: a.carryOver + (s.carryOver ?? 0),
              material: a.material + (s.material ?? 0),
              overall: a.overall + s.overall,
              ftePotential: a.ftePotential + s.ftePotential,
              fteBaseline: a.fteBaseline + s.fteBaseline,
            }),
            { efficiency: 0, carryOver: 0, material: 0, overall: 0, ftePotential: 0, fteBaseline: 0 },
          );
          // Value Driver Breakdown — 5Y totals derived from the current deep-dive/baselining data,
          // anchored to the per-scenario defaults so they reproduce exactly on load and scale on edits.
          const vdDefaults = valueDriverDefaults?.[selectedScenario];
          const presetRows = deepDiveDefaults?.[selectedScenario] ?? [];
          const sumEff = (arr: { efficiency: number }[]) => arr.reduce((s, x) => s + (x.efficiency ?? 0), 0);
          const sumCo = (arr: { carryOver: number | null }[]) => arr.reduce((s, x) => s + (x.carryOver ?? 0), 0);
          const sumMat = (arr: { material: number | null }[]) => arr.reduce((s, x) => s + (x.material ?? 0), 0);
          const scaleTo = (cur: number, base: number, total: number) => (base !== 0 ? total * (cur / base) : cur * 5);
          const vdPe = vdDefaults ? scaleTo(sumEff(prModel.steps), sumEff(presetRows), vdDefaults.processEfficiency) : sumEff(prModel.steps) * 5;
          const vdCo = vdDefaults ? scaleTo(sumCo(prModel.steps), sumCo(presetRows), vdDefaults.carryOver) : sumCo(prModel.steps) * 5;
          const vdMat = vdDefaults ? scaleTo(sumMat(prModel.steps), sumMat(presetRows), vdDefaults.material) : sumMat(prModel.steps) * 5;
          const vdTotal = vdPe + vdCo + vdMat;
          const vdSource = (s?: string): number | null =>
            s === 'pe' ? vdPe : s === 'co' ? vdCo : s === 'mat' ? vdMat : s === 'total' ? vdTotal : null;
          const valueDrivers: { name: string; active: boolean; value: number | null }[] =
            valueDriverBreakdown.map(d => ({
              name: d.name,
              active: d.active,
              value: d.active ? vdSource(d.source) : null,
            }));
          const activeDriverCount = valueDrivers.filter(d => d.active).length;
          return (
            <>
            {/* Value Driver Breakdown */}
            <div className="border border-gray-200 rounded bg-white shadow-sm">
              <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
                <span>Value Driver Breakdown</span>
                <span className="text-[10px] font-normal text-white/70">Total contribution over 5 years</span>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Total Benefits (5Y)</div>
                    <div className={`text-base font-bold ${vdTotal < 0 ? 'text-red-600' : 'text-[#00338D]'}`}>{eur(vdTotal)}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Sum of active value drivers</div>
                  </div>
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Active Value Drivers</div>
                    <div className="text-base font-bold text-[#00338D]">{activeDriverCount} / {valueDrivers.length}</div>
                  </div>
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Primary Driver</div>
                    <div className="text-base font-bold text-[#00338D]">{primaryDriverLabel}</div>
                  </div>
                </div>
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col style={{ width: '50%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Value Driver</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Contribution (5Y)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...valueDrivers].sort((a, b) => {
                      if (a.active !== b.active) return a.active ? -1 : 1;
                      return Math.abs(b.value ?? 0) - Math.abs(a.value ?? 0);
                    }).map(driver => (
                      <tr key={driver.name} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700">
                          <span className="flex items-center gap-2">
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${driver.active ? 'bg-[#00A3E0]' : 'bg-gray-300'}`} />
                            {driver.name}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${driver.active ? 'bg-[#00338D]/10 text-[#00338D]' : 'bg-gray-100 text-gray-400'}`}>
                            {driver.active ? 'Active' : 'Not applicable'}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-semibold ${!driver.active ? 'text-gray-400' : (driver.value ?? 0) < 0 ? 'text-red-600' : 'text-[#00338D]'}`}>
                          {driver.active && driver.value !== null ? eur(driver.value) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                      <td className="px-3 py-2 text-gray-800" colSpan={2}>Total Benefits</td>
                      <td className={`px-3 py-2 text-right ${vdTotal < 0 ? 'text-red-600' : 'text-[#00338D]'}`}>{eur(vdTotal)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-gray-400">
                  Values update automatically with the selected scenario, Client Baselining and Value Deep Dive.
                </div>
              </div>
            </div>
            </>
          );
        })() : (() => {
          const invoicesNum = parseNumber(baseliningData.invoicesPerYear);
          const ftesNum = parseNumber(baseliningData.totalFTEs);
          const costPerFteNum = parseNumber(baseliningData.costPerFTE) * (1 + parseNumber(baseliningData.overheadPct) / 100);
          const feePerInvoiceNum = parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice;
          const infraNum = parseNumber(feesData.infrastructureHosting);
          const supportNum = parseNumber(feesData.supportFees);
          const currentToolNum = invoicesNum * parseNumber(baseliningData.currentOcrCostPerInvoice);

          // Net efficiency gains drives all downstream calculations
          const efficiencyGains = (netEfficiencyGainsPct ?? 0) / 100;

          const costPerInvoice = invoicesNum > 0 && ftesNum > 0
            ? (ftesNum * costPerFteNum) / invoicesNum
            : 0;
          const invoicesPerFtePerYear = ftesNum > 0 && invoicesNum > 0
            ? Math.ceil(invoicesNum / ftesNum)
            : 0;
          const avgSavingsPerInvoice = costPerInvoice > 0
            ? costPerInvoice - (1 - efficiencyGains) * costPerInvoice - feePerInvoiceNum
            : 0;
          const netBenefitsPerYear = avgSavingsPerInvoice > 0 && invoicesNum > 0
            ? avgSavingsPerInvoice * invoicesNum - (infraNum + supportNum) + currentToolNum
            : 0;

          const fmtCurrency = (n: number, digits = 2) =>
            n > 0 ? `€${n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}` : '—';
          const fmtInt = (n: number) =>
            n > 0 ? n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '—';

          const Tip = ({ text, dark = false }: { text: string; dark?: boolean }) => (
            <span className="relative inline-flex items-center group ml-1 align-middle">
              <Info size={12} className={`${dark ? 'text-gray-400' : 'text-white/80'} cursor-help`} />
              <span
                className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 z-30 hidden group-hover:block bg-white text-gray-800 text-xs font-normal leading-relaxed rounded-md px-3 py-2 w-72 whitespace-normal shadow-xl border border-gray-200"
              >
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
                <span className="relative">{text}</span>
              </span>
            </span>
          );

          const totalBenefits5Y = netBenefitsPerYear > 0 ? netBenefitsPerYear * 5 : 0;
          // "Automation-driven cost savings" always equals the headline Total 5Y Savings
          // (rampedSummary is in k€ → convert to €).
          const total5YSavings = (rampedSummary?.totalSavings ?? 0) * 1000;
          const fmtMillions = (n: number) =>
            n > 0 ? `€${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 2 })}M` : '—';

          return (
            <div className="border border-gray-200 rounded bg-white shadow-sm">
              <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
                <span>Value Deep Dive</span>
                <ChevronUp size={14} />
              </div>

              {/* Calculated Inputs */}
              <div className="px-3 pt-3 pb-2">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Calculated Inputs</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="border border-gray-200 rounded bg-gray-50 px-3 py-2">
                    <div className="text-[10px] text-gray-500 mb-0.5">Dark processed invoices</div>
                    <div className="text-sm font-semibold text-[#00338D]">
                      {darkProcessedInvoices !== null
                        ? darkProcessedInvoices.toLocaleString('de-DE', { maximumFractionDigits: 0 })
                        : '—'}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">Fully automated % × Invoices per year</div>
                  </div>
                  <div className="border border-gray-200 rounded bg-gray-50 px-3 py-2">
                    <div className="text-[10px] text-gray-500 mb-0.5">Net Efficiency Gains</div>
                    <div className="text-sm font-semibold text-[#00338D]">
                      {netEfficiencyGainsPct !== null
                        ? `${netEfficiencyGainsPct.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div className="text-[9px] text-gray-400 mt-0.5">((Inv − Dark) × eff% + Dark) / Inv</div>
                  </div>
                </div>
              </div>

              {/* Section 2 — Calculated Value */}
              <div className="p-4 border-t border-gray-200">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Calculated Value</div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Total Benefits (5Y)</div>
                    <div className="text-base font-bold text-[#00338D]">{fmtMillions(totalBenefits5Y)}</div>
                    <div className="text-[10px] text-gray-400 mt-1">Net benefits / year × 5</div>
                  </div>
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Active Value Drivers</div>
                    <div className="text-base font-bold text-[#00338D]">1 / 5</div>
                  </div>
                  <div className="border border-gray-200 rounded p-3 bg-gray-50">
                    <div className="text-xs text-gray-500 mb-1">Primary Driver</div>
                    <div className="text-base font-bold text-[#00338D]">Process Efficiency</div>
                  </div>
                </div>
              </div>

              {/* Section 3 — Value Driver Breakdown */}
              <div className="p-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Value Driver Breakdown</div>
                  <div className="text-[10px] text-gray-400">Illustration of contributing drivers</div>
                </div>
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col style={{ width: '50%' }} />
                    <col style={{ width: '25%' }} />
                    <col style={{ width: '25%' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Value Driver</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Contribution (5Y)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'Automation-driven cost savings', active: true },
                      { name: 'FTE Costs Savings', active: false },
                      { name: 'Working Capital Optimization', active: false },
                      { name: 'Carry-over Effect', active: false },
                      { name: 'Material Cost Reduction', active: false },
                      { name: 'Profit Assurance', active: false },
                    ].map(driver => (
                      <tr key={driver.name} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-gray-700 flex items-center gap-2">
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${driver.active ? 'bg-[#00A3E0]' : 'bg-gray-300'}`} />
                          {driver.name}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${driver.active ? 'bg-[#00338D]/10 text-[#00338D]' : 'bg-gray-100 text-gray-400'}`}>
                            {driver.active ? 'Active' : 'Not applicable'}
                          </span>
                        </td>
                        <td className={`px-3 py-2 font-semibold ${driver.active ? 'text-[#00338D]' : 'text-gray-400'}`}>
                          {driver.active ? fmtMillions(total5YSavings) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}

        {/* TCO */}
        {!hideTco && (
        <div className="border border-gray-200 rounded bg-white shadow-sm">
        <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
          <span>Total Cost of Ownership <span className="ml-2 text-[10px] font-normal text-white/70">(5-year horizon)</span></span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyTco}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium border transition-all duration-200 ${
                (baselineCards ? prTcoApplied : tcoApplied)
                  ? 'bg-green-500 border-green-400 text-white'
                  : 'bg-white/10 border-white/30 text-white hover:bg-white/20'
              } ${(baselineCards ? prTcoFlash : tcoFlash) ? 'ring-2 ring-green-300' : ''}`}
            >
              {(baselineCards ? prTcoApplied : tcoApplied) ? (
                <>
                  <Check size={11} />
                  Applied to Fees
                </>
              ) : (
                'Apply to Scenario'
              )}
            </button>
            <ChevronUp size={14} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200" style={{ direction: 'rtl' }}>
          {/* AI Cost Model */}
          <div className="p-4" style={{ direction: 'ltr' }}>
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">AI Cost Model</div>
            {Object.entries(MODEL_OPTIONS).map(([model, options]) => {
              const isMulti = MULTI_SELECT_MODELS.has(model);
              const current = selectedModels[model];
              const isSelected = (opt: string) =>
                isMulti ? Array.isArray(current) && current.includes(opt) : current === opt;
              const handleClick = (opt: string) => {
                setSelectedModels(prev => {
                  if (isMulti) {
                    const arr = Array.isArray(prev[model]) ? (prev[model] as string[]) : [];
                    return {
                      ...prev,
                      [model]: arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt],
                    };
                  }
                  return { ...prev, [model]: opt };
                });
              };
              return (
                <div key={model} className="mb-3">
                  <div className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
                    <span>{model}</span>
                    <span className="text-[10px] text-gray-400 normal-case">
                      {isMulti ? '(select multiple)' : '(select one)'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {options.map(opt => {
                      const selected = isSelected(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => handleClick(opt)}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            selected
                              ? 'bg-[#00338D] text-white border-[#00338D]'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-[#00338D]/30'
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phase Model */}
          {(() => {
          const YEARS = 5;
          const invoicesNum = parseNumber(baseliningData.invoicesPerYear);
          const feePerInvoiceNum = parseNumber(feesData.feePerInvoice) + phaseCosts.ocrCostPerInvoice;
          const infraNum = parseNumber(feesData.infrastructureHosting);
          const supportNum = parseNumber(feesData.supportFees);
          const fmtEur = (n: number) => `€${n.toLocaleString('de-DE', { maximumFractionDigits: 0 })}`;
          const feePerInvoiceYear = invoicesNum * feePerInvoiceNum;
          const aipipPhases = [
            {
              name: 'Phase 1: PoC',
              items: [
                { desc: 'PoC', price: fmtEur(phaseCosts.poc), unit: 'fixed', total: fmtEur(phaseCosts.poc), editKey: 'poc' as const },
              ],
            },
            {
              name: 'Phase 2: Design/Development',
              items: [
                { desc: 'AI Model Training Costs', price: fmtEur(phaseCosts.aiTraining), unit: 'fixed', total: fmtEur(phaseCosts.aiTraining), editKey: 'aiTraining' as const },
              ],
            },
            {
              name: 'Phase 3: Implementation',
              items: [
                { desc: 'Implementation and Integration Cost', price: fmtEur(phaseCosts.implementation), unit: 'fixed', total: fmtEur(phaseCosts.implementation), editKey: 'implementation' as const },
                { desc: 'OCR implementation cost', price: fmtEur(phaseCosts.ocrImplementation), unit: 'fixed', total: fmtEur(phaseCosts.ocrImplementation), editKey: 'ocrImplementation' as const },
              ],
            },
            {
              name: 'Phase 4: Operation/Running',
              items: [
                {
                  desc: 'Fee per invoice',
                  price: feePerInvoiceNum > 0 ? `€${feePerInvoiceNum.toFixed(2)}` : '—',
                  unit: 'yearly',
                  total: invoicesNum > 0 && feePerInvoiceNum > 0 ? fmtEur(feePerInvoiceYear * YEARS) : '—',
                  editKey: null,
                },
                {
                  desc: 'Infrastructure & hosting',
                  price: infraNum > 0 ? fmtEur(infraNum) : '—',
                  unit: 'yearly',
                  total: infraNum > 0 ? fmtEur(infraNum * YEARS) : '—',
                  editKey: null,
                },
                {
                  desc: 'Support fee',
                  price: supportNum > 0 ? fmtEur(supportNum) : '—',
                  unit: 'yearly',
                  total: supportNum > 0 ? fmtEur(supportNum * YEARS) : '—',
                  editKey: null,
                },
                {
                  desc: 'OCR Cost per invoice',
                  price: `€${phaseCosts.ocrCostPerInvoice.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
                  unit: 'per invoice',
                  total: '—',
                  editKey: 'ocrCostPerInvoice' as const,
                },
                {
                  desc: 'OCR yearly cost',
                  price: invoicesNum > 0 ? fmtEur(phaseCosts.ocrCostPerInvoice * invoicesNum) : '—',
                  unit: 'yearly',
                  total: invoicesNum > 0 ? fmtEur(phaseCosts.ocrCostPerInvoice * invoicesNum * YEARS) : '—',
                  editKey: null,
                },
              ],
            },
          ];
          // AI PR Creation uses a scenario-driven phase model (no OCR; AI consumption + infrastructure in Phase 4)
          const prPhases = [
            {
              name: 'Phase 1: PoC',
              items: [
                { desc: 'PoC', price: fmtEur(prPhaseCosts.poc), unit: 'fixed', total: fmtEur(prPhaseCosts.poc), editKey: 'poc' },
              ],
            },
            {
              name: 'Phase 2: Design/Development',
              items: [
                { desc: 'AI Model Training Costs', price: fmtEur(prPhaseCosts.aiTraining), unit: 'fixed', total: fmtEur(prPhaseCosts.aiTraining), editKey: 'aiTraining' },
              ],
            },
            {
              name: 'Phase 3: Implementation',
              items: [
                { desc: 'Implementation and Integration Cost', price: fmtEur(prPhaseCosts.implementation), unit: 'fixed', total: fmtEur(prPhaseCosts.implementation), editKey: 'implementation' },
              ],
            },
            {
              name: 'Phase 4: Operation/Running',
              items: [
                { desc: 'AI consumption', price: fmtEur(prPhaseCosts.aiConsumption), unit: 'yearly', total: fmtEur(prPhaseCosts.aiConsumption * 5), editKey: 'aiConsumption' },
                { desc: 'Infrastructure', price: fmtEur(prPhaseCosts.infrastructure), unit: 'yearly', total: fmtEur(prPhaseCosts.infrastructure * 5), editKey: 'infrastructure' },
                { desc: 'IT Support', price: fmtEur(prPhaseCosts.itSupport), unit: 'yearly', total: fmtEur(prPhaseCosts.itSupport * 5), editKey: 'itSupport' },
                { desc: 'Cost per PR', price: `€${(prPhaseCosts.costPerPR ?? 0).toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}`, unit: 'per unit', total: fmtEur((prPhaseCosts.costPerPR ?? 0) * parseNumber(customBaseline['numberOfPRs'] || '0')), editKey: 'costPerPR' },
              ],
            },
          ];
          const activePhases = baselineCards ? prPhases : aipipPhases;
          const costObj: Record<string, number> = baselineCards ? prPhaseCosts : (phaseCosts as unknown as Record<string, number>);
          const setCostObj = (baselineCards ? setPrPhaseCosts : setPhaseCosts) as React.Dispatch<React.SetStateAction<Record<string, number>>>;
          return (
          <div className="p-4" style={{ direction: 'ltr' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Phase Model & Cost Estimates</div>
              <div className="text-[10px] text-gray-400">Totals calculated over 5 years</div>
            </div>
            <div className="space-y-3">
              {activePhases.map((phase, pIdx) => (
                <div key={phase.name}>
                  <div className="text-xs font-semibold text-[#00338D] mb-1">{phase.name}</div>
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col style={{ width: '40%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                      <col style={{ width: '20%' }} />
                    </colgroup>
                    {pIdx === 0 && (
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="text-left px-2 py-1 font-medium text-gray-500">Description</th>
                          <th className="text-left px-2 py-1 font-medium text-gray-500">Est. Unit Price</th>
                          <th className="text-left px-2 py-1 font-medium text-gray-500">Time Unit</th>
                          <th className="text-left px-2 py-1 font-medium text-gray-500">Total €</th>
                        </tr>
                      </thead>
                    )}
                    <tbody>
                      {phase.items.map((item, i) => {
                        const editKey = item.editKey as string | null;
                        const isEditing = editKey ? editingPhase[editKey] : false;
                        return (
                          <tr key={i} className="border-b border-gray-100">
                            <td className="px-2 py-1 text-gray-700">{item.desc}</td>
                            <td className="px-2 py-1 text-left text-gray-600">
                              {editKey && isEditing ? (
                                <input
                                  type="text"
                                  autoFocus
                                  value={phaseRawValue}
                                  onChange={(e) => setPhaseRawValue(e.target.value)}
                                  onBlur={() => {
                                    setCostObj(prev => ({ ...prev, [editKey]: parseNumber(phaseRawValue) }));
                                    setEditingPhase(prev => ({ ...prev, [editKey]: false }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setCostObj(prev => ({ ...prev, [editKey]: parseNumber(phaseRawValue) }));
                                      setEditingPhase(prev => ({ ...prev, [editKey]: false }));
                                    }
                                  }}
                                  className="w-24 border border-[#00338D] rounded px-1 py-0.5 text-xs focus:outline-none"
                                />
                              ) : (
                                <span className="inline-flex items-center gap-1.5">
                                  {item.price}
                                  {editKey && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPhaseRawValue(String(costObj[editKey]));
                                        setEditingPhase(prev => ({ ...prev, [editKey]: true }));
                                      }}
                                      className="text-gray-300 hover:text-[#00338D]"
                                      aria-label="Edit"
                                    >
                                      <Pencil size={10} />
                                    </button>
                                  )}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1 text-left text-gray-500">{item.unit}</td>
                            <td className="px-2 py-1 text-left font-semibold">{item.total}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
          );
          })()}
          </div>
        </div>
        )}

        <div className="flex items-center gap-2 text-xs text-gray-600 bg-[#00338D]/5 border border-[#00338D]/20 rounded px-3 py-2">
          <span className="text-[#00338D]">ℹ</span>
          Business case assumptions are based on benchmarking results and can be overwritten with client-specific inputs.
        </div>
      </div>
    </div>
  );
}
