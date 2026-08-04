import React, { useState, useMemo } from 'react';
import { X, Plus, Trash2, ChevronLeft, ChevronRight, Check, Code2, Eye, Delete } from 'lucide-react';
import { PROCESSES } from '../data/mockData';
import {
  CustomFieldDef,
  FormulaToken,
  FieldUnit,
  formulaToString,
  OP_LABEL,
  VALUE_DRIVER_OPTIONS,
} from '../utils/formula';
import type { CustomUseCaseDef, UseCaseCategory } from '../context/AppContext';

const CATEGORY_LABELS: Record<UseCaseCategory, string> = {
  AI: 'AI Cases',
  ERP: 'ERP Cases',
  TOM: 'TOM Cases',
};

const UNIT_LABEL: Record<FieldUnit, string> = {
  number: 'Number',
  currency: 'Currency (€)',
  percent: 'Percentage (%)',
};

// All Level 3 sub-process names across every process taxonomy.
function useAllL3SubProcesses(): string[] {
  return useMemo(() => {
    const names = new Set<string>();
    Object.values(PROCESSES).forEach(proc => {
      const disabled = new Set(proc.disabledSteps ?? []);
      proc.steps.filter(s => !disabled.has(s)).forEach(l2 => {
        (proc.l3KPIs[l2] ?? []).forEach(k => { if (k.l4) names.add(k.l4); });
      });
    });
    return Array.from(names).sort();
  }, []);
}

let fieldSeq = 0;
const newField = (): CustomFieldDef => ({ id: `f${Date.now()}_${fieldSeq++}`, name: '', unit: 'number' });

const STEP_TITLES = [
  'Basic Information',
  'Assign Level 3 Sub-Processes',
  'Define Baselining Fields',
  'Define Fees Fields',
  'Select Value Drivers',
  'Calculation Logic — One-Time Costs',
  'Calculation Logic — Recurring Costs',
  'Calculation Logic — Benefits',
  'Review & Save',
];

interface WizardProps {
  initialCategory: UseCaseCategory;
  onClose: () => void;
  onSave: (def: CustomUseCaseDef) => void;
  // When provided, the wizard edits an existing use case ("Return to Developer Mode").
  initialDef?: CustomUseCaseDef;
}

export function CustomUseCaseWizard({ initialCategory, onClose, onSave, initialDef }: WizardProps) {
  const allL3 = useAllL3SubProcesses();
  const editing = !!initialDef;

  // Editing skips the mode-selection screen and goes straight into Developer Mode.
  const [mode, setMode] = useState<'developer' | 'view' | null>(editing ? 'developer' : null);
  const [step, setStep] = useState(0); // 0-indexed against STEP_TITLES

  // Step 1
  const [name, setName] = useState(initialDef?.name ?? '');
  const [category, setCategory] = useState<UseCaseCategory>(initialDef?.category ?? initialCategory);
  const [description, setDescription] = useState(initialDef?.description ?? '');
  // Step 2
  const [subProcesses, setSubProcesses] = useState<string[]>(initialDef?.subProcesses ?? []);
  // Step 3 / 4
  const [baselineFields, setBaselineFields] = useState<CustomFieldDef[]>(initialDef?.baselineFields ?? []);
  const [feeFields, setFeeFields] = useState<CustomFieldDef[]>(initialDef?.feeFields ?? []);
  // Step 5
  const [valueDrivers, setValueDrivers] = useState<string[]>(initialDef?.valueDrivers ?? []);
  // Steps 6-8
  const [oneTime, setOneTime] = useState<FormulaToken[]>(initialDef?.formulas.oneTime ?? []);
  const [recurring, setRecurring] = useState<FormulaToken[]>(initialDef?.formulas.recurring ?? []);
  const [benefits, setBenefits] = useState<FormulaToken[]>(initialDef?.formulas.benefits ?? []);

  const allFormulaFields = useMemo(
    () => [...baselineFields, ...feeFields].filter(f => f.name.trim() !== ''),
    [baselineFields, feeFields],
  );

  const toggle = <T,>(list: T[], setList: (v: T[]) => void, item: T) =>
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item]);

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return name.trim() !== '';
      case 1: return subProcesses.length > 0;
      default: return true;
    }
  };

  const finish = () => {
    const def: CustomUseCaseDef = {
      id: initialDef?.id ?? `custom-${category.toLowerCase()}-${Date.now()}`,
      category,
      name: name.trim() || 'Untitled Use Case',
      description: description.trim(),
      mode: initialDef?.mode ?? mode ?? 'developer',
      subProcesses,
      baselineFields: baselineFields.filter(f => f.name.trim() !== ''),
      feeFields: feeFields.filter(f => f.name.trim() !== ''),
      valueDrivers,
      formulas: { oneTime, recurring, benefits },
    };
    onSave(def);
  };

  // ── Mode selection screen ──────────────────────────────────────────────
  if (!mode) {
    return (
      <Overlay onClose={onClose} title="Add New Use Case" subtitle={CATEGORY_LABELS[category]}>
        <div className="p-6">
          <p className="text-xs text-gray-500 mb-4">Choose how you want to create this use case.</p>
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('developer')}
              className="text-left border border-gray-200 rounded-lg p-4 hover:border-[#00338D] hover:shadow-sm transition-all"
            >
              <Code2 className="text-[#00338D] mb-2" size={22} />
              <div className="text-sm font-semibold text-[#00338D] mb-1">Developer Mode</div>
              <div className="text-xs text-gray-500">Full customization — define all parameters, calculations, and logic from scratch.</div>
            </button>
            <button
              onClick={() => setMode('view')}
              className="text-left border border-gray-200 rounded-lg p-4 hover:border-[#00A3E0] hover:shadow-sm transition-all"
            >
              <Eye className="text-[#00A3E0] mb-2" size={22} />
              <div className="text-sm font-semibold text-[#00A3E0] mb-1">View Mode</div>
              <div className="text-xs text-gray-500">Preview the use case — inputs are read-only, just like the built-in use cases.</div>
            </button>
          </div>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay
      onClose={onClose}
      title="Add New Use Case"
      subtitle={`${mode === 'developer' ? 'Developer Mode' : 'View Mode'} · Step ${step + 1} of ${STEP_TITLES.length}`}
    >
      {/* Progress */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-1">
          {STEP_TITLES.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= step ? '#00338D' : '#E5E7EB' }}
            />
          ))}
        </div>
        <h3 className="text-sm font-semibold text-[#00338D] mt-3">{STEP_TITLES[step]}</h3>
      </div>

      <div className="px-6 py-4 overflow-y-auto" style={{ maxHeight: '55vh' }}>
        {step === 0 && (
          <div className="space-y-4">
            <Labeled label="Use Case Name">
              <input
                autoFocus type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="e.g. AI Duplicate Invoice Detection"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#00338D]"
              />
            </Labeled>
            <Labeled label="Category">
              <select
                value={category} onChange={e => setCategory(e.target.value as UseCaseCategory)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#00338D]"
              >
                {(Object.keys(CATEGORY_LABELS) as UseCaseCategory[]).map(c => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </Labeled>
            <Labeled label="Description">
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                placeholder="Short description of the use case…"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-[#00338D] resize-none"
              />
            </Labeled>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">
              Select the Level 3 sub-processes this use case applies to. These determine where it appears in the Deep Dive.
            </p>
            <div className="border border-gray-200 rounded max-h-72 overflow-y-auto divide-y divide-gray-100">
              {allL3.map(sp => {
                const checked = subProcesses.includes(sp);
                return (
                  <label key={sp} className="flex items-start gap-2 text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                    <input type="checkbox" checked={checked} onChange={() => toggle(subProcesses, setSubProcesses, sp)} className="mt-0.5 accent-[#00338D]" />
                    <span className={checked ? 'text-gray-700' : 'text-gray-500'}>{sp}</span>
                  </label>
                );
              })}
            </div>
            <div className="text-[11px] text-gray-400">{subProcesses.length} selected</div>
          </div>
        )}

        {step === 2 && (
          <FieldTableEditor
            fields={baselineFields} setFields={setBaselineFields}
            nameLabel="Baseline Name" placeholder="e.g. Number of Invoices" addLabel="Add baseline field"
          />
        )}

        {step === 3 && (
          <FieldTableEditor
            fields={feeFields} setFields={setFeeFields}
            nameLabel="Fee Name" placeholder="e.g. Project Fees" addLabel="Add fee field"
          />
        )}

        {step === 4 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-500">Select the value drivers this use case contributes to.</p>
            <div className="grid grid-cols-2 gap-2">
              {VALUE_DRIVER_OPTIONS.map(vd => {
                const checked = valueDrivers.includes(vd);
                return (
                  <label key={vd} className={`flex items-start gap-2 text-xs border rounded px-3 py-2 cursor-pointer transition-colors ${checked ? 'border-[#00338D] bg-blue-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(valueDrivers, setValueDrivers, vd)} className="mt-0.5 accent-[#00338D]" />
                    <span className={checked ? 'text-gray-700' : 'text-gray-500'}>{vd}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {step === 5 && (
          <FormulaBuilder label="One-Time Costs" fields={allFormulaFields} tokens={oneTime} setTokens={setOneTime} />
        )}
        {step === 6 && (
          <FormulaBuilder label="Recurring Costs (per year)" fields={allFormulaFields} tokens={recurring} setTokens={setRecurring} />
        )}
        {step === 7 && (
          <FormulaBuilder label="Benefits (per year)" fields={allFormulaFields} tokens={benefits} setTokens={setBenefits} />
        )}

        {step === 8 && (
          <ReviewSummary
            name={name} category={CATEGORY_LABELS[category]} description={description}
            subProcesses={subProcesses} baselineFields={baselineFields} feeFields={feeFields}
            valueDrivers={valueDrivers} oneTime={oneTime} recurring={recurring} benefits={benefits}
          />
        )}
      </div>

      {/* Footer nav */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
        <button
          onClick={() => step === 0 ? (editing ? onClose() : setMode(null)) : setStep(step - 1)}
          className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-[#00338D]"
        >
          <ChevronLeft size={14} /> {step === 0 && editing ? 'Cancel' : 'Back'}
        </button>
        {step < STEP_TITLES.length - 1 ? (
          <button
            onClick={() => canProceed() && setStep(step + 1)}
            disabled={!canProceed()}
            className="flex items-center gap-1 text-xs font-semibold text-white px-4 py-2 rounded disabled:opacity-40"
            style={{ backgroundColor: '#00338D' }}
          >
            Next <ChevronRight size={14} />
          </button>
        ) : (
          <button
            onClick={finish}
            className="flex items-center gap-1.5 text-xs font-semibold text-white px-4 py-2 rounded"
            style={{ backgroundColor: '#00338D' }}
          >
            <Check size={14} /> {editing ? 'Save Changes' : 'Create Use Case'}
          </button>
        )}
      </div>
    </Overlay>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function Overlay({ children, onClose, title, subtitle }: {
  children: React.ReactNode; onClose: () => void; title: string; subtitle?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-[#00338D]">{title}</div>
            {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}

function FieldTableEditor({ fields, setFields, nameLabel, placeholder, addLabel }: {
  fields: CustomFieldDef[];
  setFields: (v: CustomFieldDef[]) => void;
  nameLabel: string; placeholder: string; addLabel: string;
}) {
  const update = (id: string, patch: Partial<CustomFieldDef>) =>
    setFields(fields.map(f => f.id === id ? { ...f, ...patch } : f));
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-gray-400 italic">No fields yet. Add rows to define the fields required for this use case.</p>
      )}
      {fields.length > 0 && (
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="grid grid-cols-[1fr_150px_36px] bg-gray-50 text-[11px] font-semibold text-gray-600 px-3 py-2 border-b border-gray-200">
            <span>{nameLabel}</span><span>Unit</span><span />
          </div>
          {fields.map(f => (
            <div key={f.id} className="grid grid-cols-[1fr_150px_36px] items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
              <input
                type="text" value={f.name} placeholder={placeholder}
                onChange={e => update(f.id, { name: e.target.value })}
                className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:border-[#00338D]"
              />
              <select
                value={f.unit} onChange={e => update(f.id, { unit: e.target.value as FieldUnit })}
                className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-[#00338D]"
              >
                {(Object.keys(UNIT_LABEL) as FieldUnit[]).map(u => <option key={u} value={u}>{UNIT_LABEL[u]}</option>)}
              </select>
              <button onClick={() => setFields(fields.filter(x => x.id !== f.id))} className="text-gray-400 hover:text-red-500 flex justify-center">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={() => setFields([...fields, newField()])}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#00338D] border border-dashed border-[#00338D]/40 rounded px-3 py-2 hover:bg-blue-50/50"
      >
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  );
}

function FormulaBuilder({ label, fields, tokens, setTokens }: {
  label: string; fields: CustomFieldDef[];
  tokens: FormulaToken[]; setTokens: (v: FormulaToken[]) => void;
}) {
  const push = (t: FormulaToken) => setTokens([...tokens, t]);
  const backspace = () => setTokens(tokens.slice(0, -1));
  const clear = () => setTokens([]);

  return (
    <div className="space-y-3">
      {/* Formula display */}
      <div className="border border-gray-200 rounded p-3 bg-gray-50 min-h-[52px] flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500 mr-1">{label} =</span>
        {tokens.length === 0 && <span className="text-xs text-gray-400 italic">click tiles below to build the formula</span>}
        {tokens.map((t, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded ${
            t.kind === 'field' ? 'bg-[#00338D] text-white' :
            t.kind === 'num' ? 'bg-[#00A3E0] text-white' :
            'bg-gray-200 text-gray-700 font-semibold'}`}>
            {t.label}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={backspace} className="flex items-center gap-1 text-[11px] text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"><Delete size={12} /> Backspace</button>
        <button onClick={clear} className="text-[11px] text-gray-500 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50">Clear</button>
      </div>

      {/* Fields */}
      <div>
        <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Fields</div>
        {fields.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No fields defined. Add baseline / fee fields in the earlier steps.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {fields.map(f => (
              <button key={f.id} onClick={() => push({ kind: 'field', value: f.id, label: f.name })}
                className="text-xs px-2.5 py-1 rounded border border-[#00338D]/40 text-[#00338D] hover:bg-blue-50">
                {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Operators + numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Operators</div>
          <div className="flex flex-wrap gap-1.5">
            {(['+', '-', '*', '/'] as const).map(op => (
              <button key={op} onClick={() => push({ kind: 'op', value: op, label: OP_LABEL[op] })}
                className="w-9 h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                {OP_LABEL[op]}
              </button>
            ))}
            <button onClick={() => push({ kind: 'lparen', value: '(', label: '(' })} className="w-9 h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">(</button>
            <button onClick={() => push({ kind: 'rparen', value: ')', label: ')' })} className="w-9 h-9 rounded border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">)</button>
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold text-gray-500 mb-1.5">Numbers</div>
          <NumberPad onEnter={v => push({ kind: 'num', value: v, label: v })} />
        </div>
      </div>
    </div>
  );
}

function NumberPad({ onEnter }: { onEnter: (v: string) => void }) {
  const [val, setVal] = useState('');
  const commit = () => { if (val.trim() !== '') { onEnter(val.trim()); setVal(''); } };
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number" value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit(); }}
        placeholder="constant"
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-[#00338D]"
      />
      <button onClick={commit} className="text-xs font-semibold text-white px-3 py-1.5 rounded" style={{ backgroundColor: '#00A3E0' }}>Add</button>
    </div>
  );
}

function ReviewSummary(props: {
  name: string; category: string; description: string;
  subProcesses: string[]; baselineFields: CustomFieldDef[]; feeFields: CustomFieldDef[];
  valueDrivers: string[]; oneTime: FormulaToken[]; recurring: FormulaToken[]; benefits: FormulaToken[];
}) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="border border-gray-200 rounded overflow-hidden">
      <div className="bg-gray-50 px-3 py-1.5 text-[11px] font-semibold text-[#00338D] border-b border-gray-200">{title}</div>
      <div className="px-3 py-2 text-xs text-gray-600">{children}</div>
    </div>
  );
  const list = (items: string[]) => items.length ? items.join(', ') : <span className="text-gray-400 italic">none</span>;
  return (
    <div className="space-y-3">
      <Section title="Basic Info">
        <div><span className="font-semibold">{props.name || '—'}</span> · {props.category}</div>
        {props.description && <div className="text-gray-500 mt-1">{props.description}</div>}
      </Section>
      <Section title="Sub-Processes">{list(props.subProcesses)}</Section>
      <Section title="Baselining Fields">{list(props.baselineFields.map(f => f.name).filter(Boolean))}</Section>
      <Section title="Fees Fields">{list(props.feeFields.map(f => f.name).filter(Boolean))}</Section>
      <Section title="Value Drivers">{list(props.valueDrivers)}</Section>
      <Section title="Formulas">
        <div className="space-y-1">
          <div><span className="font-semibold">One-Time Costs</span> = {formulaToString(props.oneTime)}</div>
          <div><span className="font-semibold">Recurring Costs</span> = {formulaToString(props.recurring)}</div>
          <div><span className="font-semibold">Benefits</span> = {formulaToString(props.benefits)}</div>
        </div>
      </Section>
    </div>
  );
}
