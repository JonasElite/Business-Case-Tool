import React, { useState, useMemo } from 'react';
import { formatThousands } from '../utils/formatNumber';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart, Area, LabelList, ReferenceDot, ReferenceLine, ReferenceArea,
} from 'recharts';
import { ChevronDown, ChevronUp, ShoppingCart, Inbox, CheckCircle2, Package, TrendingDown, Shield, BarChart2, FileText, Zap, Cpu, AlertCircle, BookOpen } from 'lucide-react';
import { useApp, CustomUseCaseDef } from '../context/AppContext';
import { USE_CASES, PHASES, generateYearlyData, generateCumulativeData, getFilteredUseCases } from '../data/mockData';
import { useLocation } from 'react-router';
import { AipipPage, AipipSummaryValues } from './AipipPage';
import { SSC_INDIA_SUBPROCESSES } from './Benchmarking';
import { CustomUseCaseWizard } from '../components/CustomUseCaseWizard';
import { CustomUseCasePage } from './CustomUseCasePage';
import scenario1Image from '../../imports/image-13.png';
import scenario2Image from '../../imports/image-14.png';

const ICON_MAP: Record<string, React.ReactNode> = {
  'shopping-cart': <ShoppingCart size={13} />,
  'inbox': <Inbox size={13} />,
  'check-circle': <CheckCircle2 size={13} />,
  'package': <Package size={13} />,
  'trending-down': <TrendingDown size={13} />,
  'shield': <Shield size={13} />,
  'bar-chart': <BarChart2 size={13} />,
  'file-text': <FileText size={13} />,
  'zap': <Zap size={13} />,
  'cpu': <Cpu size={13} />,
  'alert-circle': <AlertCircle size={13} />,
  'book-open': <BookOpen size={13} />,
};

const SCENARIO_OPTIMIZATION: Record<string, number> = {
  'Conservative': 0.35,
  'Moderate': 0.55,
  'Optimistic': 0.75,
};

// Parse number handling European notation (comma as decimal)
function parseNumber(value: string): number {
  if (!value) return 0;
  const s = value.trim();
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
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
  nonRecurringCosts: number;
  netSavings: number;
  netSavingsAccumulated: number;
}

function calculateBusinessCase(
  invoicesPerYear: string,
  totalFTEs: string,
  costPerFTE: string,
  scenario: string,
  projectFees: string,
  feePerInvoice: string,
  infrastructureHosting: string,
  supportFees: string,
  actualToolFees: string,
): { data: BusinessCaseData[], totalSavings: number, scenario: string } | null {
  // Parse inputs (handle European notation with comma as decimal)
  const invoices = parseNumber(invoicesPerYear);
  const ftes = parseNumber(totalFTEs);
  const fteYearlyCost = parseNumber(costPerFTE);
  const projFees = parseNumber(projectFees);
  const invoiceFee = parseNumber(feePerInvoice);
  const infraCost = parseNumber(infrastructureHosting);
  const support = parseNumber(supportFees);
  const toolFees = parseNumber(actualToolFees);

  // Validate required fields
  if (!invoices || !ftes || !fteYearlyCost || !scenario || !(scenario in SCENARIO_OPTIMIZATION)) {
    return null;
  }

  const optimizationRate = SCENARIO_OPTIMIZATION[scenario];
  const baselineCost = ftes * fteYearlyCost;
  const reducedFTEs = ftes * (1 - optimizationRate);

  const data: BusinessCaseData[] = [];
  let accumulated = 0;

  for (let year = 1; year <= 5; year++) {
    // Baseline cost (without automation) - constant each year
    const baseline = baselineCost;

    // Recurring costs (with automation)
    const automatedLaborCost = reducedFTEs * fteYearlyCost;
    const automatedInvoiceCost = invoices * invoiceFee;
    const recurringCost = automatedLaborCost + automatedInvoiceCost + infraCost + support + toolFees;

    // Non-recurring costs only in Year 1
    const nonRecurring = year === 1 ? projFees : 0;

    // Net savings = Baseline - Recurring - Project fees (only in Year 1)
    const netSavings = baseline - recurringCost - nonRecurring;

    // Accumulated net savings
    accumulated += netSavings;

    const dataPoint = {
      year: `Year ${year}`,
      yearNum: year,
      baselineCost: Math.round(baseline / 1000), // Not displayed, only for calculation
      recurringCosts: -Math.round(recurringCost / 1000), // NEGATIVE (cost bar going down from zero)
      nonRecurringCosts: year === 1 ? -Math.round(nonRecurring / 1000) : null, // NEGATIVE Year 1 only, null for others
      netSavings: Math.round(netSavings / 1000), // POSITIVE (savings bar going up from zero)
      netSavingsAccumulated: Math.round(accumulated / 1000), // POSITIVE (cumulative line)
    };

    console.log(`Year ${year} - Baseline: €${Math.round(baseline / 1000)}k, Recurring cost: €${Math.round(recurringCost / 1000)}k, Non-recurring: €${Math.round(nonRecurring / 1000)}k, Net Savings: €${dataPoint.netSavings}k, Accumulated: €${dataPoint.netSavingsAccumulated}k`);
    data.push(dataPoint);
  }

  return {
    data,
    totalSavings: Math.round(accumulated / 1000),
    scenario,
  };
}

const MODEL_OPTIONS: Record<string, string[]> = {
  'Solution Model': ['SaaS / [X]aaS', 'Module / Add-on', 'Deployed standard software', 'Integration frameworks', 'Custom development'],
  'Operating Model': ['SaaS (AI-as-a-Service)', 'AI Platform-as-a-Service', 'Hybrid', 'On-prem / self-hosted'],
  'Licensing & Pricing Model': ['License', 'Seat-based', 'Open-source', 'Usage-based', 'Credit-based', 'Outcome-based'],
  'Org Fit Model': ['Fit to existing AI', 'Organizational readiness', 'Data readiness', 'Contract specifications', 'Contingency'],
};

const MULTI_SELECT_MODELS = new Set(['Org Fit Model']);

function UCExpanded({ uc }: { uc: typeof USE_CASES[0] }) {
  const location = useLocation();
  const isDemo = location.pathname.startsWith('/demo');
  const baseliningSectionTitle = isDemo ? 'Benchmark baselining' : 'Client baselining';

  const cumData = generateCumulativeData(uc);
  const [selectedModels, setSelectedModels] = useState<Record<string, string | string[]>>({
    'Solution Model': 'SaaS / [X]aaS',
    'Operating Model': 'SaaS (AI-as-a-Service)',
    'Licensing & Pricing Model': 'License',
    'Org Fit Model': [],
  });

  const [baseliningData, setBaseliningsData] = useState({
    invoicesPerYear: '',
    totalFTEs: '',
    costPerFTE: '',
    scenario: '',
  });

  const [feesData, setFeesData] = useState({
    projectFees: '',
    feePerInvoice: '',
    infrastructureHosting: '',
    supportFees: '',
    actualToolFees: '',
  });

  // Bar visibility state
  const [barVisibility, setBarVisibility] = useState({
    nonRecurring: true,
    recurring: true,
    netSavings: true,
  });

  const toggleBarVisibility = (bar: 'nonRecurring' | 'recurring' | 'netSavings') => {
    setBarVisibility(prev => ({ ...prev, [bar]: !prev[bar] }));
  };

  // Calculate business case data
  const businessCaseResult = useMemo(() => {
    return calculateBusinessCase(
      baseliningData.invoicesPerYear,
      baseliningData.totalFTEs,
      baseliningData.costPerFTE,
      baseliningData.scenario,
      feesData.projectFees,
      feesData.feePerInvoice,
      feesData.infrastructureHosting,
      feesData.supportFees,
      feesData.actualToolFees,
    );
  }, [baseliningData, feesData]);

  return (
    <tr>
      <td colSpan={8} className="p-0">
        <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Business Case Overview */}
            <div className="border border-gray-200 rounded bg-white">
              <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
                <span>Business Case (annual view)</span>
                {businessCaseResult && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-green-600 px-2 py-1 rounded">
                      {businessCaseResult.scenario} {(SCENARIO_OPTIMIZATION[businessCaseResult.scenario] * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs">
                      Total 5Y savings: €{businessCaseResult.totalSavings.toLocaleString('de-DE')}k
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3" style={{ height: 220 }}>
                {!businessCaseResult ? (
                  <div className="h-full flex items-center justify-center text-center">
                    <div className="text-xs text-gray-500 max-w-xs">
                      Complete baselining and fees to generate chart
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart
                      data={businessCaseResult.data}
                      margin={{ top: 20, right: 20, bottom: 4, left: 50 }}
                      barGap={2}
                      barCategoryGap="20%"
                    >
                      <defs>
                        {/* Hatched pattern for non-recurring costs */}
                        <pattern id="redHatch" patternUnits="userSpaceOnUse" width="8" height="8">
                          <path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" stroke="#ef4444" strokeWidth="1" />
                        </pattern>
                      </defs>

                      {/* Background shading: red below zero, green above zero */}
                      <ReferenceArea y1={-1000} y2={0} fill="#fee2e2" fillOpacity={0.3} />
                      <ReferenceArea y1={0} y2={9000} fill="#dcfce7" fillOpacity={0.3} />

                      {/* Thick black line at zero */}
                      <ReferenceLine y={0} stroke="#000" strokeWidth={2} />

                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="year" tick={{ fontSize: 10 }} />
                      <YAxis
                        domain={[-1000, 9000]}
                        ticks={[-1000, 0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={v => `${v}k€`}
                        label={{ value: 'Costs / Savings (in k€)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }}
                      />
                      <Tooltip
                        formatter={(v: number, name: string) => [`€${Math.abs(v)}k`, name]}
                        contentStyle={{ fontSize: 10 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />

                      {/* Non-recurring costs - hatched red bar (negative/down, Year 1 only) */}
                      {barVisibility.nonRecurring && (
                        <Bar
                          dataKey="nonRecurringCosts"
                          name="Non-recurring costs"
                          fill="url(#redHatch)"
                          barSize={30}
                          legendType="rect"
                        />
                      )}

                      {/* Recurring costs - dark blue bar (negative/down) */}
                      {barVisibility.recurring && (
                        <Bar
                          dataKey="recurringCosts"
                          name="Recurring costs"
                          fill="#1e40af"
                          barSize={30}
                          legendType="rect"
                        />
                      )}

                      {/* Net Savings - green bar (positive/up) */}
                      {barVisibility.netSavings && (
                        <Bar
                          dataKey="netSavings"
                          name="Net Savings"
                          fill="#22c55e"
                          barSize={30}
                          legendType="rect"
                        />
                      )}

                      {/* Cumulative Savings - dashed orange line with diamonds */}
                      <Line
                        type="monotone"
                        dataKey="netSavingsAccumulated"
                        name="Cumulative Savings"
                        stroke="#f97316"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={{ fill: '#f97316', r: 5, strokeWidth: 2, stroke: '#fff' }}
                        legendType="line"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Chart Controls */}
            {businessCaseResult && (
              <div className="border border-gray-200 rounded bg-white mt-4">
                <div className="bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700">
                  Chart Display Options
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-6">
                    {/* Non-recurring costs toggle */}
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
                        <span>Non-recurring costs</span>
                      </span>
                    </label>

                    {/* Recurring costs toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={barVisibility.recurring}
                        onChange={() => toggleBarVisibility('recurring')}
                        className="w-4 h-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="flex items-center gap-2 text-xs">
                        <span className="w-4 h-4 bg-[#1e40af] border border-gray-300"></span>
                        <span>Recurring costs</span>
                      </span>
                    </label>

                    {/* Net savings toggle */}
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

            {/* Cumulative Cost vs Value */}
            <div className="border border-gray-200 rounded bg-white">
              <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">Cumulative Cost vs Value</div>
              <div className="p-3" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={cumData} margin={{ top: 4, right: 10, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} tickFormatter={v => `M${v}`} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `€${v}k`} />
                    <Tooltip formatter={(v: number) => [`€${v}k`, '']} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="cumulativeCost" name="Cumulative Cost" stroke="#ef4444" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="cumulativeValue" name="Cumulative Value" stroke="#22c55e" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Client/Benchmark Baselining */}
          <div className="border border-gray-200 rounded bg-white">
            <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">
              {baseliningSectionTitle}
            </div>
            <div className="p-4">
              <div className="grid grid-cols-4 gap-4">
                {/* Invoices per year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Invoices per year
                  </label>
                  <input
                    type="text"
                    value={baseliningData.invoicesPerYear}
                    onChange={(e) => setBaseliningsData(prev => ({ ...prev, invoicesPerYear: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Total FTEs for invoicing */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Total FTEs for invoicing
                  </label>
                  <input
                    type="text"
                    value={baseliningData.totalFTEs}
                    onChange={(e) => setBaseliningsData(prev => ({ ...prev, totalFTEs: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Cost per FTE/year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Cost per FTE/year
                  </label>
                  <input
                    type="text"
                    value={baseliningData.costPerFTE}
                    onChange={(e) => setBaseliningsData(prev => ({ ...prev, costPerFTE: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Choose scenario */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Choose scenario
                  </label>
                  <select
                    value={baseliningData.scenario}
                    onChange={(e) => setBaseliningsData(prev => ({ ...prev, scenario: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  >
                    <option value="">Select...</option>
                    <option value="Conservative">Conservative</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Optimistic">Optimistic</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Fees */}
          <div className="border border-gray-200 rounded bg-white">
            <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">
              Fees
            </div>
            <div className="p-4">
              <div className="grid grid-cols-5 gap-4">
                {/* Project fees */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Project fees
                  </label>
                  <input
                    type="text"
                    value={feesData.projectFees}
                    onChange={(e) => setFeesData(prev => ({ ...prev, projectFees: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Fee per invoice */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Fee per invoice
                  </label>
                  <input
                    type="text"
                    value={feesData.feePerInvoice}
                    onChange={(e) => setFeesData(prev => ({ ...prev, feePerInvoice: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Infrastructure & hosting per year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Infrastructure & hosting per year
                  </label>
                  <input
                    type="text"
                    value={feesData.infrastructureHosting}
                    onChange={(e) => setFeesData(prev => ({ ...prev, infrastructureHosting: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Support fees per year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Support fees per year
                  </label>
                  <input
                    type="text"
                    value={feesData.supportFees}
                    onChange={(e) => setFeesData(prev => ({ ...prev, supportFees: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>

                {/* Actual Tool Fees per year */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    Actual Tool Fees per year
                  </label>
                  <input
                    type="text"
                    value={feesData.actualToolFees}
                    onChange={(e) => setFeesData(prev => ({ ...prev, actualToolFees: formatThousands(e.target.value) }))}
                    placeholder="Enter value"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Value Deep Dive */}
          <div className="border border-gray-200 rounded bg-white">
            <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
              <span>Value Deep Dive</span>
              <ChevronUp size={14} />
            </div>
            <div className="p-8 text-center text-gray-400 text-sm">
              <div className="font-medium text-gray-500 mb-1">Placeholder</div>
              <div className="text-xs">Value driver details will be displayed here</div>
            </div>
          </div>

          {/* TCO */}
          <div className="border border-gray-200 rounded bg-white">
            <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
              <span>Total Cost of Ownership</span>
              <ChevronUp size={14} />
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200">
              {/* AI Cost Model */}
              <div className="p-4">
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
                                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
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
              <div className="p-4">
                <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Phase Model & Cost Estimates</div>
                <div className="space-y-3">
                  {PHASES.map(phase => (
                    <div key={phase.name}>
                      <div className="text-xs font-semibold text-[#00338D] mb-1">{phase.name}</div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50">
                            <th className="text-left px-2 py-1 font-medium text-gray-500">Description</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-500">Est. Unit Price</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-500">Time Unit</th>
                            <th className="text-right px-2 py-1 font-medium text-gray-500">Total €</th>
                          </tr>
                        </thead>
                        <tbody>
                          {phase.items.map((item, i) => (
                            <tr key={i} className="border-b border-gray-100">
                              <td className="px-2 py-1 text-gray-700">{item.desc}</td>
                              <td className="px-2 py-1 text-right text-gray-600">{item.price}</td>
                              <td className="px-2 py-1 text-right text-gray-500">{item.unit}</td>
                              <td className="px-2 py-1 text-right font-semibold">{item.total}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400 bg-blue-50 border border-blue-100 rounded px-3 py-2">
            <span className="text-blue-400">ℹ</span>
            Business case assumptions are based on benchmarking results and can be overwritten with client-specific inputs.
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Category definitions ──────────────────────────────────────────────────────
type CategoryKey = 'AI' | 'ERP' | 'TOM';

const CATEGORIES: { key: CategoryKey; label: string; accent: string }[] = [
  { key: 'AI',  label: 'AI Cases',  accent: '#00338D' },
  { key: 'ERP', label: 'ERP Cases', accent: '#1A2B60' },
  { key: 'TOM', label: 'TOM Cases', accent: '#FD349C' },
];

const BUILTIN_USE_CASES: Record<CategoryKey, { id: string; name: string; comingSoon?: boolean }[]> = {
  AI:  [
    { id: 'ai-pip',                         name: 'AI PIP' },
    { id: 'ai-pr-creation',                 name: 'AI PR Creation' },
    { id: 'supplier-mdm',                   name: 'Supplier MDM',                              comingSoon: true },
    { id: 'supplier-communication-agent',   name: 'Supplier Communication Agent',              comingSoon: true },
    { id: 'ai-goods-receipt',               name: 'AI Driven Goods Receipt Processing',        comingSoon: true },
    { id: 'ai-contact-center',              name: 'AI Contact Center',                         comingSoon: true },
  ],
  ERP: [
    { id: 'guided-individual-procurement',          name: 'Guided Individual Procurement',               comingSoon: true },
    { id: '3-way-match-optimization',               name: '3-Way-Match Optimization',                    comingSoon: true },
    { id: 'discount-cash-discount-optimization',    name: 'Discount Usage / Cash Discount Optimization', comingSoon: true },
  ],
  TOM: [
    { id: 'ssc-india', name: 'SCC' },
  ],
};

export function Simulation() {
  const { customUseCases, addCustomUseCase } = useApp();
  const [selectedUc, setSelectedUc] = useState<Record<CategoryKey, string>>({
    AI:  '',
    ERP: '',
    TOM: '',
  });
  const [wizardFor, setWizardFor] = useState<CategoryKey | null>(null);
  const [editingDef, setEditingDef] = useState<CustomUseCaseDef | null>(null);
  const [ucOverrides, setUcOverrides] = useState<Record<string, AipipSummaryValues>>({});

  const handleValuesChange = (id: string) => (values: AipipSummaryValues) => {
    setUcOverrides(prev => ({ ...prev, [id]: values }));
  };

  const handleDropdownChange = (cat: CategoryKey, value: string) => {
    if (value === '__add_new__') {
      setWizardFor(cat);
    } else {
      setSelectedUc(prev => ({ ...prev, [cat]: value }));
    }
  };

  const ucListFor = (cat: CategoryKey) => [
    ...BUILTIN_USE_CASES[cat],
    ...customUseCases.filter(u => u.category === cat).map(u => ({ id: u.id, name: u.name })),
  ];

  const renderContent = (cat: CategoryKey, ucId: string) => {
    if (!ucId) return (
      <div className="p-8 text-center text-xs text-gray-400">
        Select a use case from the dropdown above to load its business case simulation.
      </div>
    );
    if (ucId === 'ai-pip') return (
      <AipipPage
        onValuesChange={handleValuesChange('ai-pip')}
        defaultCaseL2="Invoice Processing & Payment"
        defaultCaseL3="Validate, Approve, & Post Invoices / Credit Notes"
      />
    );
    if (ucId === 'ai-pr-creation') return (
      <AipipPage
        onValuesChange={handleValuesChange('ai-pr-creation')}
        useCaseId="ai-pr-creation"
        title="AI PR Creation - Business Case Simulator"
        subtitle="AI Powered Purchase Requisition Creation"
        summaryTitle="AI PR Creation"
        summaryDescription="AI PR Creation supports the purchase requisition process by improving PR quality, reducing manual effort and enabling higher process compliance across Purchase-to-Pay."
        scenarioOptions={[
          'Scenario I: AI + LLM Guided PR Creation App',
          'Scenario II: AI-Assisted PR Quality Check',
          'Custom',
        ]}
        baselineCards={AI_PR_CREATION_BASELINE_CARDS}
        baselineDefaults={AI_PR_CREATION_BASELINE_DEFAULTS}
        deepDiveDefaults={AI_PR_CREATION_DEEPDIVE_DEFAULTS}
        valueDriverDefaults={AI_PR_CREATION_VALUE_DRIVER_DEFAULTS}
        annualDefaults={AI_PR_CREATION_ANNUAL_DEFAULTS}
        defaultSelectedModels={AI_PR_CREATION_MODELS}
        phaseDefaults={AI_PR_CREATION_PHASE_DEFAULTS}
        prFeeDefaults={AI_PR_CREATION_FEE_DEFAULTS}
        scenarioOverview={[
          {
            title: 'Scenario I: AI + LLM Guided PR Creation App',
            description: 'A guided AI and LLM-based interface supports users during PR creation and submits structured requisition data for further processing.',
            tags: ['Guided Creation', 'Process Transformation', 'Higher Automation Impact'],
            image: scenario2Image,
          },
          {
            title: 'Scenario II: AI-Assisted PR Quality Check',
            description: 'AI validates and enriches purchase requisition data after PR creation to improve quality, reduce rework and support approval decisions.',
            tags: ['Quality Check', 'Existing Process Enhancement', 'Lower Automation Impact'],
            image: scenario1Image,
          },
        ]}
      />
    );
    if (ucId === 'ssc-india') return (
      <AipipPage
        onValuesChange={handleValuesChange('ssc-india')}
        useCaseId="ssc-india"
        title="SCC India - Business Case Simulator"
        subtitle="Shared Service Center India — FTE Cost Savings"
        summaryTitle="SCC India"
        summaryDescription="Migration of transactional finance activities to a Shared Service Center in India, delivering FTE cost savings through onshore-to-offshore labour arbitrage."
        scenarioOptions={SSC_INDIA_SCENARIOS}
        baselineCards={SSC_INDIA_BASELINE_CARDS}
        baselineDefaults={SSC_INDIA_BASELINE_DEFAULTS}
        deepDiveDefaults={SSC_INDIA_DEEPDIVE_DEFAULTS}
        valueDriverDefaults={SSC_INDIA_VALUE_DRIVER_DEFAULTS}
        annualDefaults={SSC_INDIA_ANNUAL_DEFAULTS}
        defaultSelectedModels={SSC_INDIA_MODELS}
        prFeeDefaults={SSC_INDIA_FEE_DEFAULTS}
        feeFields={SSC_INDIA_FEE_FIELDS}
        annualEfficiencyLabel="FTE Costs Savings"
        valueDriverBreakdown={SSC_INDIA_VALUE_DRIVERS}
        primaryDriverLabel="FTE Costs Savings"
        hideTco
        subProcessOptions={SSC_INDIA_SUBPROCESSES}
      />
    );
    // Custom (user-created) use cases
    const customDef = customUseCases.find(u => u.id === ucId);
    if (customDef) return <CustomUseCasePage def={customDef} onEnterDeveloperMode={() => setEditingDef(customDef)} />;
    // Generic placeholder for ERP / TOM built-ins not yet implemented
    const ucName = ucListFor(cat).find(u => u.id === ucId)?.name ?? ucId;
    return (
      <div className="p-8 text-center text-xs text-gray-400 space-y-2">
        <div className="text-sm font-semibold text-gray-600">{ucName}</div>
        <div>Business case simulation for this use case is coming soon.</div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {CATEGORIES.map(cat => {
        const list = ucListFor(cat.key);
        const selected = selectedUc[cat.key];
        return (
          <div key={cat.key} className="border border-gray-200 rounded bg-white shadow-sm overflow-hidden">
            {/* Category header */}
            <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: cat.accent }}>
              <span className="text-white text-sm font-semibold">{cat.label}</span>
            </div>

            {/* Dropdown row */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <select
                value={selected}
                onChange={e => handleDropdownChange(cat.key, e.target.value)}
                className="border border-gray-300 rounded px-3 py-1.5 text-xs font-medium focus:outline-none focus:border-[#00338D] min-w-[220px]"
              >
                <option value="">Choose use case…</option>
                {list.map(uc => (
                  <option key={uc.id} value={uc.id} disabled={uc.comingSoon}>
                    {uc.name}{uc.comingSoon ? ' — Coming Soon' : ''}
                  </option>
                ))}
                <option value="__add_new__">+ Add new use case</option>
              </select>

              <button
                onClick={() => setWizardFor(cat.key)}
                className="px-2.5 py-1 rounded text-xs font-semibold text-white"
                style={{ backgroundColor: cat.accent }}
              >
                + Add new use case
              </button>
            </div>

            {/* Content */}
            {renderContent(cat.key, selected)}
          </div>
        );
      })}

      {wizardFor && (
        <CustomUseCaseWizard
          initialCategory={wizardFor}
          onClose={() => setWizardFor(null)}
          onSave={(def) => {
            addCustomUseCase(def);
            setSelectedUc(prev => ({ ...prev, [def.category]: def.id }));
            setWizardFor(null);
          }}
        />
      )}

      {editingDef && (
        <CustomUseCaseWizard
          initialCategory={editingDef.category}
          initialDef={editingDef}
          onClose={() => setEditingDef(null)}
          onSave={(def) => {
            addCustomUseCase(def);
            setSelectedUc(prev => ({ ...prev, [def.category]: def.id }));
            setEditingDef(null);
          }}
        />
      )}
    </div>
  );
}

// ── AI PR Creation props extracted as module-level constants to avoid inline-array churn ──
const AI_PR_CREATION_BASELINE_CARDS = [
  {
    title: 'Commercial baseline',
    fields: [
      { key: 'fteCostPerYear', label: 'FTE cost per year', format: 'euro' as const },
      { key: 'procurementVolume', label: 'Procurement volume', format: 'euro' as const },
      { key: 'maverickBuying', label: 'Maverick buying', format: 'percent' as const },
      { key: 'addressableShare', label: 'Addressable share', format: 'percent' as const },
      { key: 'avgSavingsProcurement', label: 'Average savings through procurement process', format: 'percent' as const },
    ],
  },
  {
    title: 'Purchase requisition baseline',
    fields: [
      { key: 'numberOfPRs', label: 'Number of PRs', format: 'number' as const },
      { key: 'modifiedPRs', label: 'Modified PRs', format: 'percent' as const },
      { key: 'impactPRCreation', label: 'Impact of PR creation', format: 'percent' as const },
      { key: 'impactPRReviewReduction', label: 'Impact of PR review reduction', format: 'percent' as const },
      { key: 'prModificationReduction', label: 'PR modification reduction', format: 'percent' as const },
      { key: 'impactPRModification', label: 'Impact PR modification', format: 'percent' as const },
    ],
  },
  {
    title: 'Purchase order baseline',
    fields: [
      { key: 'numberOfPOs', label: 'Number of POs', format: 'number' as const },
      { key: 'modifiedPOs', label: 'Modified POs', format: 'percent' as const },
      { key: 'impactPOCreationReduction', label: 'Impact of PO creation reduction', format: 'percent' as const },
      { key: 'impactPOReviewReduction', label: 'Impact of PO review reduction', format: 'percent' as const },
      { key: 'poModificationReduction', label: 'PO modification reduction', format: 'percent' as const },
      { key: 'impactPOModification', label: 'Impact PO modification', format: 'percent' as const },
    ],
  },
  {
    title: 'Downstream process baseline',
    fields: [
      { key: 'numberOfASN', label: 'Number of ASN', format: 'number' as const },
      { key: 'numberOfExceptions', label: 'Number of exceptions', format: 'number' as const },
      { key: 'numberOfInvoices', label: 'Number of invoices', format: 'number' as const },
      { key: 'impactAcceptRefuseReceipt', label: 'Impact accept/refuse receipt of goods/service', format: 'percent' as const },
      { key: 'impactResearchResolveExceptions', label: 'Impact research/resolve exceptions', format: 'percent' as const },
      { key: 'impactInvoiceValidationReduction', label: 'Impact invoice validation reduction', format: 'percent' as const },
    ],
  },
];

const AI_PR_CREATION_BASELINE_DEFAULTS = {
  'Scenario II: AI-Assisted PR Quality Check': {
    fteCostPerYear: '60000', procurementVolume: '750000000', maverickBuying: '20',
    avgSavingsProcurement: '7', numberOfPRs: '80867', modifiedPRs: '19962',
    numberOfPOs: '75000', modifiedPOs: '10000', numberOfASN: '170000',
    numberOfExceptions: '42500', numberOfInvoices: '230000', addressableShare: '5',
    impactPRCreation: '10', impactPRReviewReduction: '15', prModificationReduction: '45',
    impactPRModification: '25', impactPOCreationReduction: '5', impactPOReviewReduction: '5',
    poModificationReduction: '15', impactPOModification: '5', impactAcceptRefuseReceipt: '5',
    impactResearchResolveExceptions: '5', impactInvoiceValidationReduction: '5',
  },
  'Scenario I: AI + LLM Guided PR Creation App': {
    fteCostPerYear: '60000', procurementVolume: '750000000', maverickBuying: '20',
    avgSavingsProcurement: '7', numberOfPRs: '80867', modifiedPRs: '19962',
    numberOfPOs: '75000', modifiedPOs: '10000', numberOfASN: '170000',
    numberOfExceptions: '42500', numberOfInvoices: '230000', addressableShare: '30',
    impactPRCreation: '85', impactPRReviewReduction: '20', prModificationReduction: '70',
    impactPRModification: '30', impactPOCreationReduction: '10', impactPOReviewReduction: '10',
    poModificationReduction: '20', impactPOModification: '10', impactAcceptRefuseReceipt: '10',
    impactResearchResolveExceptions: '10', impactInvoiceValidationReduction: '10',
  },
};

const AI_PR_CREATION_DEEPDIVE_DEFAULTS = {
  'Scenario II: AI-Assisted PR Quality Check': [
    { process: 'Requisition', l2: '1.1', name: 'Create Requisition', influence: 'Indirect', improvement: 10, fteBaseline: 5.0, asIs: 25, withAI: 35, ftePotential: 0.5, efficiency: 30000, carryOver: -2700, material: 525000, overall: 552300 },
    { process: 'Requisition', l2: '1.2', name: 'Review & Approve Requisition', influence: 'Indirect', improvement: 15, fteBaseline: 1.5, asIs: 50, withAI: 65, ftePotential: 0.225, efficiency: 13500, carryOver: -900, material: null, overall: 12600 },
    { process: 'Requisition', l2: '1.3', name: 'Modify or Cancel Requisition', influence: 'Indirect', improvement: 25, fteBaseline: 2.0, asIs: 25, withAI: 50, ftePotential: 0.5, efficiency: 30000, carryOver: 40005, material: null, overall: 70005 },
    { process: 'Purchasing', l2: '2.1', name: 'Create Purchase Order', influence: 'Indirect', improvement: 5, fteBaseline: 0.0, asIs: 75, withAI: 80, ftePotential: 0.0, efficiency: 0, carryOver: 0, material: null, overall: 0 },
    { process: 'Purchasing', l2: '2.2', name: 'Review, Approve & Distribute Purchase Order', influence: 'Indirect', improvement: 5, fteBaseline: 0.4, asIs: 75, withAI: 80, ftePotential: 0.02, efficiency: 1200, carryOver: -240, material: null, overall: 960 },
    { process: 'Purchasing', l2: '2.4', name: 'Modify or Cancel Purchase Order', influence: 'Indirect', improvement: 5, fteBaseline: 0.1, asIs: 25, withAI: 30, ftePotential: 0.005, efficiency: 300, carryOver: 849, material: null, overall: 1149 },
    { process: 'Receiving', l2: '3.2', name: 'Accept/refuse & record receipt of goods/service', influence: 'Indirect', improvement: 5, fteBaseline: 18.0, asIs: 25, withAI: 30, ftePotential: 0.9, efficiency: 54000, carryOver: -64800, material: null, overall: -10800 },
    { process: 'Receiving', l2: '3.3', name: 'Research/resolve exceptions', influence: 'Indirect', improvement: 5, fteBaseline: 5.0, asIs: 25, withAI: 30, ftePotential: 0.25, efficiency: 15000, carryOver: 13800, material: null, overall: 28800 },
    { process: 'Invoicing', l2: '4.2', name: 'Validate, Approve & Post Invoices / Credit Notes', influence: 'Indirect', improvement: 5, fteBaseline: 35.0, asIs: 50, withAI: 55, ftePotential: 1.75, efficiency: 105000, carryOver: null, material: null, overall: 105000 },
  ],
  'Scenario I: AI + LLM Guided PR Creation App': [
    { process: 'Requisition', l2: '1.1', name: 'Create Requisition', influence: 'Direct', improvement: 85, fteBaseline: 5.0, asIs: 25, withAI: 85, ftePotential: 4.25, efficiency: 255000, carryOver: -2700, material: 3150000, overall: 3402300 },
    { process: 'Requisition', l2: '1.2', name: 'Review & Approve Requisition', influence: 'Indirect', improvement: 20, fteBaseline: 1.5, asIs: 50, withAI: 70, ftePotential: 0.3, efficiency: 18000, carryOver: -5400, material: null, overall: 12600 },
    { process: 'Requisition', l2: '1.3', name: 'Modify or Cancel Requisition', influence: 'Direct / Indirect', improvement: 30, fteBaseline: 2.0, asIs: 25, withAI: 55, ftePotential: 0.6, efficiency: 36000, carryOver: 57288, material: null, overall: 93288 },
    { process: 'Purchasing', l2: '2.1', name: 'Create Purchase Order', influence: 'Indirect', improvement: 10, fteBaseline: 0.0, asIs: 75, withAI: 85, ftePotential: 0.0, efficiency: 0, carryOver: 0, material: null, overall: 0 },
    { process: 'Purchasing', l2: '2.2', name: 'Review, Approve & Distribute Purchase Order', influence: 'Indirect', improvement: 10, fteBaseline: 0.4, asIs: 75, withAI: 85, ftePotential: 0.04, efficiency: 2400, carryOver: -1440, material: null, overall: 960 },
    { process: 'Purchasing', l2: '2.4', name: 'Modify or Cancel Purchase Order', influence: 'Indirect', improvement: 10, fteBaseline: 0.1, asIs: 25, withAI: 35, ftePotential: 0.01, efficiency: 600, carryOver: 912, material: null, overall: 1512 },
    { process: 'Receiving', l2: '3.2', name: 'Accept/refuse & record receipt of goods/service', influence: 'Indirect', improvement: 10, fteBaseline: 18.0, asIs: 25, withAI: 35, ftePotential: 1.8, efficiency: 108000, carryOver: -64800, material: null, overall: 43200 },
    { process: 'Receiving', l2: '3.3', name: 'Research/resolve exceptions', influence: 'Indirect', improvement: 10, fteBaseline: 5.0, asIs: 25, withAI: 35, ftePotential: 0.5, efficiency: 30000, carryOver: 29700, material: null, overall: 59700 },
    { process: 'Invoicing', l2: '4.2', name: 'Validate, Approve & Post Invoices / Credit Notes', influence: 'Indirect', improvement: 10, fteBaseline: 35.0, asIs: 50, withAI: 60, ftePotential: 3.5, efficiency: 210000, carryOver: null, material: null, overall: 210000 },
  ],
};

const AI_PR_CREATION_VALUE_DRIVER_DEFAULTS = {
  'Scenario II: AI-Assisted PR Quality Check': { processEfficiency: 1162000, carryOver: -65268, material: 2450000, totalBenefits: 3546732 },
  'Scenario I: AI + LLM Guided PR Creation App': { processEfficiency: 2970000, carryOver: 61020, material: 14175000, totalBenefits: 17206020 },
};

const AI_PR_CREATION_ANNUAL_DEFAULTS = {
  'Scenario II: AI-Assisted PR Quality Check': { totalBenefits: 3546732, processEfficiency: 1162000, carryOver: -65268, material: 2450000, netBenefits: 3080041, cumNpv: 2400762, roi: 6.6 },
  'Scenario I: AI + LLM Guided PR Creation App': { totalBenefits: 17206020, processEfficiency: 2970000, carryOver: 61020, material: 14175000, netBenefits: 16444819, cumNpv: 12819931, roi: 21.6 },
};

const AI_PR_CREATION_MODELS = {
  'Solution Model': 'Custom development',
  'Operating Model': 'AI Platform-as-a-Service',
  'Licensing & Pricing Model': 'Usage-based',
  'Org Fit Model': ['Organizational readiness', 'Data readiness', 'Contingency'],
};

const AI_PR_CREATION_PHASE_DEFAULTS = {
  'Scenario II: AI-Assisted PR Quality Check': { poc: 20000, aiTraining: 90000, implementation: 300000, aiConsumption: 78000, infrastructure: 20000, itSupport: 30000 },
  'Scenario I: AI + LLM Guided PR Creation App': { poc: 20000, aiTraining: 240000, implementation: 500000, aiConsumption: 155000, infrastructure: 40000, itSupport: 45000 },
  'Custom': { poc: 20000, aiTraining: 90000, implementation: 300000, aiConsumption: 78000, infrastructure: 20000, itSupport: 30000 },
};

const AI_PR_CREATION_FEE_DEFAULTS = {
  'Scenario I: AI + LLM Guided PR Creation App': { projectFees: '760000', feePerPR: '0', infrastructureHosting: '40000', supportFees: '45000', aiConsumption: '155000' },
  'Scenario II: AI-Assisted PR Quality Check': { projectFees: '410000', feePerPR: '0', infrastructureHosting: '20000', supportFees: '30000', aiConsumption: '78000' },
  'Custom': { projectFees: '0', feePerPR: '0', infrastructureHosting: '0', supportFees: '0', aiConsumption: '0' },
};

// ── SCC (TOM Case) — FTE-based offshoring business case ──────────────────
const SSC_INDIA_SCENARIOS = ['SCC Migration', 'Custom'];

const SSC_INDIA_BASELINE_CARDS = [
  {
    title: 'Client Baselining',
    fields: [
      { key: 'currentTotalFTEs',      label: 'Current Total FTEs',                  format: 'number' as const },
      { key: 'costPerFTEOnshore',     label: 'Cost per FTE / Year (onshore)',       format: 'euro' as const },
      { key: 'overheadPct',           label: 'Overhead (%)',                        format: 'percent' as const },
      { key: 'costPerFTEOffshore',    label: 'Cost per FTE SSC (offshore)',         format: 'euro' as const },
      { key: 'implementationMonths',  label: 'Implementation Period (months)',      format: 'number' as const },
    ],
  },
];

const SSC_INDIA_BASELINE_DEFAULTS = {
  'SCC Migration': {
    currentTotalFTEs: '50', costPerFTEOnshore: '80000', overheadPct: '20',
    costPerFTEOffshore: '25000', implementationMonths: '9',
  },
  'Custom': {
    currentTotalFTEs: '', costPerFTEOnshore: '', overheadPct: '',
    costPerFTEOffshore: '', implementationMonths: '',
  },
};

// Deep-dive rows (FTE cost savings across the migrated functions) — efficiency sums to the 5Y anchor
const SSC_INDIA_DEEPDIVE_DEFAULTS = {
  'SCC Migration': [
    { process: 'SCC', l2: '1', name: 'Transactional Processing (AP / AR)', influence: 'Direct',   improvement: 100, fteBaseline: 25, asIs: 0, withAI: 100, ftePotential: 25, efficiency: 8875000, carryOver: 0, material: null, overall: 8875000 },
    { process: 'SCC', l2: '2', name: 'Master Data & Reporting',            influence: 'Direct',   improvement: 100, fteBaseline: 15, asIs: 0, withAI: 100, ftePotential: 15, efficiency: 5325000, carryOver: 0, material: null, overall: 5325000 },
    { process: 'SCC', l2: '3', name: 'Controlling & Support Activities',    influence: 'Direct',   improvement: 100, fteBaseline: 10, asIs: 0, withAI: 100, ftePotential: 10, efficiency: 3550000, carryOver: 0, material: null, overall: 3550000 },
  ],
};

const SSC_INDIA_VALUE_DRIVER_DEFAULTS = {
  'SCC Migration': { processEfficiency: 17750000, carryOver: 0, material: 0, totalBenefits: 17750000 },
};

const SSC_INDIA_ANNUAL_DEFAULTS = {
  'SCC Migration': { totalBenefits: 17750000, processEfficiency: 17750000, carryOver: 0, material: 0, netBenefits: 15950000, cumNpv: 12000000, roi: 8.9 },
};

const SSC_INDIA_FEE_DEFAULTS = {
  'SCC Migration': { projectFees: '800000', feePerPR: '0', infrastructureHosting: '200000', supportFees: '0', aiConsumption: '0' },
  'Custom':              { projectFees: '0',      feePerPR: '0', infrastructureHosting: '0',      supportFees: '0', aiConsumption: '0' },
};

const SSC_INDIA_MODELS = {
  'Solution Model': 'Shared Service Center',
  'Operating Model': 'Captive SSC (India)',
  'Licensing & Pricing Model': 'FTE-based',
  'Org Fit Model': ['Organizational readiness', 'Transition management'],
};

const SSC_INDIA_VALUE_DRIVERS = [
  { name: 'FTE Costs Savings',              active: true,  source: 'total' as const },
  { name: 'Automation-driven cost savings', active: false },
  { name: 'Working Capital Optimization',   active: false },
  { name: 'Carry-over Effect',              active: false },
  { name: 'Material Cost Reduction',        active: false },
  { name: 'Profit Assurance',               active: false },
];

const SSC_INDIA_FEE_FIELDS = [
  { key: 'projectFees',           label: 'Project Fees',  prefix: '€' },
  { key: 'infrastructureHosting', label: 'Running Costs', prefix: '€' },
];