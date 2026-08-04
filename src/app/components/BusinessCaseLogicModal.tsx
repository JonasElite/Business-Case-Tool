import {
  X,
  Layers,
  ClipboardList,
  Calculator,
  TrendingUp,
  LineChart,
  ArrowRight,
} from 'lucide-react';

interface BusinessCaseLogicModalProps {
  open: boolean;
  onClose: () => void;
}

function FormulaBox({ label, formula }: { label?: string; formula: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
      {label && <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</div>}
      <code className="text-[12px] text-[#00338D] font-mono leading-relaxed">{formula}</code>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center w-7 h-7 rounded bg-[#00338D]/10 text-[#00338D]">
        {icon}
      </div>
      <h3 className="text-sm font-semibold text-[#00338D]">{title}</h3>
    </div>
  );
}

export function BusinessCaseLogicModal({ open, onClose }: BusinessCaseLogicModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        style={{ width: '88vw', height: '83vh' }}
      >
        {/* Header */}
        <div className="bg-[#00338D] text-white px-6 py-4 flex items-start justify-between shrink-0">
          <div className="pr-8">
            <h2 className="text-base font-semibold">Business Case Calculation Logic</h2>
            <p className="text-xs text-white/80 mt-1 leading-relaxed max-w-4xl">
              This view explains how the AI PR Creation business case is calculated across client
              baseline assumptions, process-level value effects and annual financial impact.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8 bg-white">
          {/* Section 1 — Scenario selection */}
          <section>
            <SectionHeader icon={<Layers size={16} />} title="1. Scenario selection" />
            <p className="text-xs text-gray-600 leading-relaxed mb-3">
              The business case is based on a selected implementation scenario. Each scenario carries
              its own set of default assumptions for automation levels and process impact.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-xs font-semibold text-[#00338D] mb-1">
                  Scenario I: AI-Assisted PR Quality Check
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  AI validates and enriches purchase requisition data after PR creation. The process
                  remains largely unchanged, but PR quality, rework reduction and approval efficiency
                  improve.
                </p>
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="text-xs font-semibold text-[#00338D] mb-1">
                  Scenario II: AI + LLM Guided PR Creation App
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  A guided AI and LLM-based interface supports users during PR creation. The process
                  is more strongly transformed and therefore uses higher automation and impact
                  assumptions.
                </p>
              </div>
            </div>
            <div className="mt-3 text-[11px] text-gray-500 bg-[#00A3E0]/5 border-l-2 border-[#00A3E0] px-3 py-2 rounded-r">
              Switching the scenario updates the default assumptions, process-level impacts, value
              driver contributions and annual business case results.
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Section 2 — Client baseline assumptions */}
          <section>
            <SectionHeader icon={<ClipboardList size={16} />} title="2. Client baseline assumptions" />
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-[#00338D] text-white text-left">
                    <th className="px-3 py-2 font-semibold w-48">Input category</th>
                    <th className="px-3 py-2 font-semibold">Example inputs</th>
                    <th className="px-3 py-2 font-semibold w-72">Purpose in calculation</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {[
                    {
                      cat: 'Commercial baseline',
                      inputs:
                        'FTE cost per year, procurement volume, Maverick Buying, addressable share, average savings through procurement process',
                      purpose: 'Defines monetary baseline and material cost reduction potential',
                    },
                    {
                      cat: 'Purchase requisition baseline',
                      inputs:
                        'Number of PRs, modified PRs, PR creation impact, PR review impact, PR modification impact',
                      purpose:
                        'Defines baseline effort and improvement assumptions for requisition-related process steps',
                    },
                    {
                      cat: 'Purchase order baseline',
                      inputs:
                        'Number of POs, modified POs, PO creation impact, PO review impact, PO modification impact',
                      purpose:
                        'Captures downstream effects from improved PR quality on purchase order processing',
                    },
                    {
                      cat: 'Downstream process baseline',
                      inputs:
                        'Number of ASN, exceptions, invoices, receiving impact, exception impact, invoice validation impact',
                      purpose:
                        'Captures carry-over effects into receiving, exception handling and invoicing',
                    },
                  ].map((row, i) => (
                    <tr key={row.cat} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-semibold text-[#00338D] align-top">{row.cat}</td>
                      <td className="px-3 py-2 align-top leading-relaxed">{row.inputs}</td>
                      <td className="px-3 py-2 align-top leading-relaxed">{row.purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 text-[11px] text-gray-500 bg-[#00A3E0]/5 border-l-2 border-[#00A3E0] px-3 py-2 rounded-r">
              When assumptions are manually changed, the scenario switches to Custom and all dependent
              value and annual business case figures are recalculated.
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Section 3 — Process-level value calculation */}
          <section>
            <SectionHeader icon={<Calculator size={16} />} title="3. Process-level value calculation" />
            <div className="space-y-3">
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-[#00338D] mb-2">Step 1: FTE effort per document</div>
                <FormulaBox formula="FTE effort per document = FTE baseline / relevant document volume" />
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-[#00338D] mb-2">Step 2: FTE effort per document with AI</div>
                <FormulaBox formula="FTE effort per document with AI = FTE effort per document × (1 – improvement assumption)" />
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-[#00338D] mb-2">Step 3: Process efficiency enhancement</div>
                <div className="space-y-2">
                  <FormulaBox formula="Process efficiency enhancement = current FTE cost baseline – future FTE effort with AI" />
                  <FormulaBox
                    label="Detailed formula"
                    formula="(FTE baseline × FTE cost per year) – (FTE effort per document with AI × document volume × FTE cost per year)"
                  />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-[#00338D] mb-2">Step 4: Change in officially processed documents</div>
                <FormulaBox formula="Additional processed documents = document volume × (1 + Maverick Buying × addressable share) – document volume" />
              </div>
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-[#00338D] mb-2">Step 5: Carry-over effect</div>
                <FormulaBox formula="Carry-over effect = – FTE effort per document with AI × additional processed documents × FTE cost per year" />
              </div>
            </div>
            <div className="mt-3 text-[11px] text-gray-600 leading-relaxed bg-gray-50 border border-gray-200 px-3 py-2 rounded">
              The carry-over effect can be negative because reduced Maverick Buying leads to more
              documents being processed through the official procurement process. This increases
              process volume but improves compliance and enables material cost reduction.
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Section 4 — Value driver calculation */}
          <section>
            <SectionHeader icon={<TrendingUp size={16} />} title="4. Value driver calculation" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col">
                <div className="text-xs font-semibold text-[#00338D] mb-1">Process Efficiency Enhancement</div>
                <p className="text-[11px] text-gray-600 leading-relaxed mb-3 flex-1">
                  Quantifies FTE-related efficiency gains from reduced manual effort across affected
                  P2P process steps.
                </p>
                <FormulaBox formula="Current FTE effort cost – future AI-supported FTE effort cost" />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col">
                <div className="text-xs font-semibold text-[#00338D] mb-1">Carry-over Effect</div>
                <p className="text-[11px] text-gray-600 leading-relaxed mb-3 flex-1">
                  Quantifies additional or reduced processing effort caused by changes in document
                  volume after more spend is routed through the official procurement process.
                </p>
                <FormulaBox formula="– AI-supported effort per document × additional processed documents × FTE cost per year" />
              </div>
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 flex flex-col">
                <div className="text-xs font-semibold text-[#00338D] mb-1">Material Cost Reduction</div>
                <p className="text-[11px] text-gray-600 leading-relaxed mb-3 flex-1">
                  Quantifies savings from reduced Maverick Buying and higher procurement process
                  compliance.
                </p>
                <FormulaBox formula="Procurement volume × Maverick Buying × addressable share × average savings through procurement process" />
              </div>
            </div>
            <div className="mt-3">
              <FormulaBox
                label="Sum logic"
                formula="Overall reduction potential = Process Efficiency Enhancement + Carry-over Effect + Material Cost Reduction"
              />
            </div>
          </section>

          <div className="border-t border-gray-100" />

          {/* Section 5 — Annual business case view */}
          <section>
            <SectionHeader icon={<LineChart size={16} />} title="5. Annual business case view" />
            <ul className="space-y-2 text-[11px] text-gray-600 leading-relaxed">
              {[
                'Process-level value effects are aggregated into total annual benefits.',
                'Benefits are distributed over the selected time horizon based on implementation and rollout assumptions.',
                'TCO values are added as annual investment and running cost.',
                'Net benefits are calculated as total benefits minus allocated investment.',
                'Inflation, discounting and WACC are used to derive NPV and cumulative NPV.',
                'ROI is calculated based on total net benefits relative to total investment.',
              ].map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#00A3E0] shrink-0" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            {/* Flow visualization */}
            <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
              <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Calculation flow
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {[
                  'Client Baseline',
                  'Scenario Assumptions',
                  'Process-Level Value Calculation',
                  'Value Driver Aggregation',
                  'TCO Allocation',
                  'Annual View / ROI / NPV',
                ].map((step, i, arr) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="inline-block px-3 py-1.5 rounded bg-white border border-[#00338D]/20 text-[11px] font-medium text-[#00338D]">
                      {step}
                    </span>
                    {i < arr.length - 1 && <ArrowRight size={14} className="text-[#00A3E0] shrink-0" />}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-3 flex justify-end shrink-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-[#00338D] text-white text-xs font-semibold hover:bg-[#002C77] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
