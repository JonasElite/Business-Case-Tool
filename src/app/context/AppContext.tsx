import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CustomFieldDef, FormulaToken } from '../utils/formula';

const SAVED_CASES_KEY = 'kpmg-saved-case-drivers';
const SAVED_INPUTS_KEY = 'kpmg-saved-case-inputs';
const CUSTOM_UC_KEY = 'kpmg-custom-use-cases';
const L3_FTE_OVERRIDES_KEY = 'kpmg-l3-fte-overrides';
// Shared with Home.tsx (STORAGE_KEY) — the persisted Home "Save" snapshot.
const HOME_SNAPSHOT_KEY = 'aibct_home_snapshot';

// Read the last saved Home snapshot so every page (Overview, Business Case, …)
// hydrates from it on mount — not just the Home page. This makes a Home "Save"
// reflect immediately everywhere, even after a reload or direct navigation.
function loadHomeSnapshot(): HomeSnapshot | null {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(HOME_SNAPSHOT_KEY) : null;
    return raw ? (JSON.parse(raw) as HomeSnapshot) : null;
  } catch {
    return null;
  }
}

function loadL3FteOverrides(): Record<string, string> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(L3_FTE_OVERRIDES_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export type UseCaseCategory = 'AI' | 'ERP' | 'TOM';

// A fully user-defined use case created through the "Add new use case" wizard.
export interface CustomUseCaseDef {
  id: string;
  category: UseCaseCategory;
  name: string;
  description: string;
  mode: 'developer' | 'view';
  subProcesses: string[];            // selected Level 3 sub-process names
  baselineFields: CustomFieldDef[];
  feeFields: CustomFieldDef[];
  valueDrivers: string[];            // canonical value-driver names
  formulas: {
    oneTime: FormulaToken[];
    recurring: FormulaToken[];
    benefits: FormulaToken[];
  };
}

function loadCustomUseCases(): CustomUseCaseDef[] {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(CUSTOM_UC_KEY) : null;
    return raw ? (JSON.parse(raw) as CustomUseCaseDef[]) : [];
  } catch {
    return [];
  }
}

function loadSavedCaseInputs(): Record<string, Record<string, unknown>> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SAVED_INPUTS_KEY) : null;
    return raw ? (JSON.parse(raw) as Record<string, Record<string, unknown>>) : {};
  } catch {
    return {};
  }
}

type SavedCaseDrivers = Record<string, {
  title: string;
  drivers: Record<string, number>;
  bySubprocess: Record<string, Record<string, number>>;
}>;

function loadSavedCaseDrivers(): SavedCaseDrivers {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SAVED_CASES_KEY) : null;
    return raw ? (JSON.parse(raw) as SavedCaseDrivers) : {};
  } catch {
    return {};
  }
}

export interface ClientData {
  client: string;
  industry: string;
  subIndustry: string;
  employees: string;
  fteFinance: string;
  country: string;
  revenue: string;
}

interface AppState {
  selectedProcesses: string[];
  selectedUseCases: string[];
  naicsCode: string;
  clientData: ClientData;
  benchmarkQuartile: Record<string, string>;
  clientPosition: 'Q25' | 'Q50' | 'Q75' | 'Custom';
  benchmarkReference: 'Q25' | 'Q50' | 'Q75';
  l3SelectedSteps: Record<string, string[]>;
  l2Baselines: Record<string, Record<number, string>>;
  l3Baselines: Record<string, Record<string, Record<number, string>>>;
  l3DegreeOfAutomation: Record<string, Record<string, Record<number, string>>>;
  fteValues: Record<string, Record<string, string>>;
  // User-edited Client FTE values in the Level 3 Subprocess Summary, keyed by
  // `${processId}::${step}::${l4}`. Overrides the benchmark/allocation-derived value.
  l3FteOverrides: Record<string, string>;
  // Saved business cases → value driver 5Y totals, keyed by use case id then driver name.
  // `bySubprocess` maps L3 subprocess name → driver name → 5Y value, for per-row deep dive display.
  savedCaseDrivers: Record<string, {
    title: string;
    drivers: Record<string, number>;
    bySubprocess: Record<string, Record<string, number>>;
  }>;
  // Full snapshot of a case's editable inputs (baselining, fees, scenario, etc.), keyed by use case id
  savedCaseInputs: Record<string, Record<string, unknown>>;
  // User-created custom use cases (from the "Add new use case" wizard)
  customUseCases: CustomUseCaseDef[];
}

export interface HomeSnapshot {
  clientData: ClientData;
  selectedProcesses: string[];
  fteValues: Record<string, Record<string, string>>;
  selectedUseCases: string[];
  showProcessScope: boolean;
  showUseCaseScope: boolean;
  savedAt: string;
}

interface AppContextType extends AppState {
  toggleProcess: (id: string) => void;
  toggleUseCase: (id: string) => void;
  updateClientData: (data: Partial<ClientData>) => void;
  setBenchmarkQuartile: (processId: string, quartile: string) => void;
  setClientPosition: (v: 'Q25' | 'Q50' | 'Q75' | 'Custom') => void;
  setBenchmarkReference: (v: 'Q25' | 'Q50' | 'Q75') => void;
  toggleL3Step: (processId: string, step: string) => void;
  setL3Steps: (processId: string, steps: string[]) => void;
  setNaicsCode: (code: string) => void;
  setL2Baseline: (processId: string, idx: number, value: string) => void;
  setL3Baseline: (processId: string, step: string, idx: number, value: string) => void;
  setL3DegreeOfAutomation: (processId: string, step: string, idx: number, value: string) => void;
  setFteValue: (processId: string, field: string, value: string) => void;
  setL3FteOverride: (key: string, value: string) => void;
  restoreSnapshot: (snap: HomeSnapshot) => void;
  resetAll: () => void;
  saveCaseDrivers: (id: string, title: string, drivers: Record<string, number>, bySubprocess: Record<string, Record<string, number>>) => void;
  saveCaseInputs: (id: string, inputs: Record<string, unknown>) => void;
  addCustomUseCase: (def: CustomUseCaseDef) => void;
  removeCustomUseCase: (id: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  // Hydrate Home-derived state from the persisted "Save" snapshot so any page
  // reflects the latest saved config immediately (not only after visiting Home).
  const homeSnap = loadHomeSnapshot();
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>(homeSnap?.selectedProcesses ?? ['P2P']);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(homeSnap?.selectedUseCases ?? ['ai-pip', 'ai-pr-creation']);
  const [clientData, setClientData] = useState<ClientData>(
    homeSnap
      ? { fteFinance: '', ...homeSnap.clientData }
      : { client: '', industry: '', subIndustry: '', employees: '', fteFinance: '', country: '', revenue: '' },
  );
  const [benchmarkQuartile, setBenchmarkQuartileState] = useState<Record<string, string>>({ P2P: 'Q50', O2C: 'Q50', R2R: 'Q50' });
  const [l3SelectedSteps, setL3SelectedSteps] = useState<Record<string, string[]>>({});
  const [l2Baselines, setL2Baselines] = useState<Record<string, Record<number, string>>>({});
  const [l3Baselines, setL3Baselines] = useState<Record<string, Record<string, Record<number, string>>>>({});
  const [l3DegreeOfAutomation, setL3DegreeOfAutomationState] = useState<Record<string, Record<string, Record<number, string>>>>({});
  const [fteValues, setFteValues] = useState<Record<string, Record<string, string>>>(homeSnap?.fteValues ?? {});
  const [l3FteOverrides, setL3FteOverrides] = useState<Record<string, string>>(loadL3FteOverrides);
  const [naicsCode, setNaicsCode] = useState('');

  // Persist Client FTE overrides so they survive navigation, remounts, and page reloads
  useEffect(() => {
    try {
      window.localStorage.setItem(L3_FTE_OVERRIDES_KEY, JSON.stringify(l3FteOverrides));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [l3FteOverrides]);

  const setL3FteOverride = (key: string, value: string) => {
    setL3FteOverrides(prev => ({ ...prev, [key]: value }));
  };
  const [clientPosition, setClientPosition] = useState<'Q25' | 'Q50' | 'Q75' | 'Custom'>('Q50');
  const [benchmarkReference, setBenchmarkReference] = useState<'Q25' | 'Q50' | 'Q75'>('Q25');
  const [savedCaseDrivers, setSavedCaseDrivers] = useState<SavedCaseDrivers>(loadSavedCaseDrivers);

  // Persist saved cases so they survive navigation, remounts, and page reloads
  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_CASES_KEY, JSON.stringify(savedCaseDrivers));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [savedCaseDrivers]);

  const saveCaseDrivers = (id: string, title: string, drivers: Record<string, number>, bySubprocess: Record<string, Record<string, number>>) => {
    setSavedCaseDrivers(prev => ({ ...prev, [id]: { title, drivers, bySubprocess } }));
  };

  const [savedCaseInputs, setSavedCaseInputs] = useState<Record<string, Record<string, unknown>>>(loadSavedCaseInputs);

  useEffect(() => {
    try {
      window.localStorage.setItem(SAVED_INPUTS_KEY, JSON.stringify(savedCaseInputs));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [savedCaseInputs]);

  const saveCaseInputs = (id: string, inputs: Record<string, unknown>) => {
    setSavedCaseInputs(prev => ({ ...prev, [id]: inputs }));
  };

  const [customUseCases, setCustomUseCases] = useState<CustomUseCaseDef[]>(loadCustomUseCases);

  useEffect(() => {
    try {
      window.localStorage.setItem(CUSTOM_UC_KEY, JSON.stringify(customUseCases));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [customUseCases]);

  const addCustomUseCase = (def: CustomUseCaseDef) => {
    setCustomUseCases(prev => [...prev.filter(u => u.id !== def.id), def]);
  };

  const removeCustomUseCase = (id: string) => {
    setCustomUseCases(prev => prev.filter(u => u.id !== id));
  };

  const toggleProcess = (id: string) => {
    setSelectedProcesses(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleUseCase = (id: string) => {
    setSelectedUseCases(prev =>
      prev.includes(id) ? prev.filter(u => u !== id) : [...prev, id]
    );
  };

  const updateClientData = (data: Partial<ClientData>) => {
    setClientData(prev => ({ ...prev, ...data }));
  };

  const setBenchmarkQuartile = (processId: string, quartile: string) => {
    setBenchmarkQuartileState(prev => ({ ...prev, [processId]: quartile }));
  };

  const toggleL3Step = (processId: string, step: string) => {
    setL3SelectedSteps(prev => {
      const current = prev[processId] || [];
      return {
        ...prev,
        [processId]: current.includes(step)
          ? current.filter(s => s !== step)
          : [...current, step],
      };
    });
  };

  const setL3Steps = (processId: string, steps: string[]) => {
    setL3SelectedSteps(prev => ({ ...prev, [processId]: steps }));
  };

  const setL2Baseline = (processId: string, idx: number, value: string) => {
    setL2Baselines(prev => ({
      ...prev,
      [processId]: { ...(prev[processId] || {}), [idx]: value },
    }));
  };

  const setL3Baseline = (processId: string, step: string, idx: number, value: string) => {
    setL3Baselines(prev => ({
      ...prev,
      [processId]: {
        ...(prev[processId] || {}),
        [step]: { ...((prev[processId] || {})[step] || {}), [idx]: value },
      },
    }));
  };

  const setL3DegreeOfAutomation = (processId: string, step: string, idx: number, value: string) => {
    setL3DegreeOfAutomationState(prev => ({
      ...prev,
      [processId]: {
        ...(prev[processId] || {}),
        [step]: { ...((prev[processId] || {})[step] || {}), [idx]: value },
      },
    }));
  };

  const setFteValue = (processId: string, field: string, value: string) => {
    setFteValues(prev => ({
      ...prev,
      [processId]: { ...(prev[processId] || {}), [field]: value },
    }));
  };

  const restoreSnapshot = (snap: HomeSnapshot) => {
    setClientData({ fteFinance: '', ...snap.clientData });
    setSelectedProcesses(snap.selectedProcesses);
    setFteValues(snap.fteValues);
    setSelectedUseCases(snap.selectedUseCases);
  };

  const resetAll = () => {
    setClientData({ client: '', industry: '', subIndustry: '', employees: '', fteFinance: '', country: '', revenue: '' });
    setSelectedProcesses([]);
    setSelectedUseCases([]);
    setFteValues({});
    setL3SelectedSteps({});
    setL2Baselines({});
    setL3Baselines({});
    setL3DegreeOfAutomationState({});
    setBenchmarkQuartileState({ P2P: 'Q50', O2C: 'Q50', R2R: 'Q50' });
    setL3FteOverrides({});
    setSavedCaseDrivers({});
    setSavedCaseInputs({});
    setCustomUseCases([]);
  };

  return (
    <AppContext.Provider value={{
      selectedProcesses, selectedUseCases, naicsCode, setNaicsCode,
      clientData, benchmarkQuartile,
      clientPosition, benchmarkReference,
      l3SelectedSteps, l2Baselines, l3Baselines, l3DegreeOfAutomation, fteValues,
      l3FteOverrides,
      savedCaseDrivers, savedCaseInputs, customUseCases,
      toggleProcess, toggleUseCase, updateClientData, setBenchmarkQuartile,
      setClientPosition, setBenchmarkReference,
      toggleL3Step, setL3Steps, setL2Baseline, setL3Baseline, setL3DegreeOfAutomation, setFteValue,
      setL3FteOverride,
      restoreSnapshot, resetAll, saveCaseDrivers, saveCaseInputs,
      addCustomUseCase, removeCustomUseCase,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
