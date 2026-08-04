import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { ShoppingCart, Inbox, CheckCircle2, Package, TrendingDown, Shield, BarChart2, FileText, Zap, Cpu, AlertCircle, BookOpen } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getFilteredUseCases } from '../data/mockData';

const ICON_MAP: Record<string, ReactNode> = {
  'shopping-cart': <ShoppingCart size={12} />,
  'inbox': <Inbox size={12} />,
  'check-circle': <CheckCircle2 size={12} />,
  'package': <Package size={12} />,
  'trending-down': <TrendingDown size={12} />,
  'shield': <Shield size={12} />,
  'bar-chart': <BarChart2 size={12} />,
  'file-text': <FileText size={12} />,
  'zap': <Zap size={12} />,
  'cpu': <Cpu size={12} />,
  'alert-circle': <AlertCircle size={12} />,
  'book-open': <BookOpen size={12} />,
};

const PIE_COLORS = ['#00338D', '#00A3E0', '#002C77', '#0065BD', '#4D9EC8', '#6BBFDE', '#B3DFF2'];

function formatK(val: number) {
  if (val >= 1000) return `€${(val / 1000).toFixed(1)}M`;
  return `€${val}k`;
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="border border-gray-200 rounded p-3">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-xl font-bold text-[#00338D]">{value}</div>
      {sub && <div className="text-xs text-green-600 mt-0.5">{sub}</div>}
    </div>
  );
}

export function Dashboard() {
  const { selectedUseCases, toggleUseCase, selectedProcesses } = useApp();
  const [leverLevel, setLeverLevel] = useState<'L2' | 'L3'>('L2');

  const availableUseCases = getFilteredUseCases(selectedProcesses);
  const selected = availableUseCases.filter(uc => selectedUseCases.includes(uc.id));

  // Computed KPIs
  const totalBenefits = selected.reduce((s, uc) => s + uc.benefits, 0);
  const totalOneTime = selected.reduce((s, uc) => s + uc.oneTime, 0);
  const totalRunY5 = selected.reduce((s, uc) => s + uc.runY5, 0);
  const costSavingsY5 = Math.round(totalBenefits / 5);
  const ebitY5 = Math.round(costSavingsY5 * 1.18);
  const revenueY5 = Math.round(costSavingsY5 * 1.09);
  const runCostsY5 = Math.round(totalRunY5 / 5);
  const investCum = totalOneTime;
  const roiY5 = selected.length > 0 ? Math.round(selected.reduce((s, uc) => s + uc.roi, 0) / selected.length) : 0;
  const breakEven = investCum > 0 && costSavingsY5 > 0 ? (investCum / costSavingsY5).toFixed(2) : '—';

  // Pie chart data
  const totalNpv = selected.reduce((s, uc) => s + uc.npv, 0);
  const pieData = selected.map(uc => ({
    name: uc.name.length > 22 ? uc.name.slice(0, 22) + '…' : uc.name,
    value: totalNpv > 0 ? Math.round((uc.npv / totalNpv) * ebitY5) : 0,
  }));

  // Top 10 Levers mock data
  const leverDataL2 = [
    { name: 'Invoice Proc.', value: Math.round(ebitY5 * 0.22) },
    { name: 'Purchasing', value: Math.round(ebitY5 * 0.18) },
    { name: 'Req. Review', value: Math.round(ebitY5 * 0.15) },
    { name: 'Sourcing', value: Math.round(ebitY5 * 0.13) },
    { name: 'Contract Mgmt', value: Math.round(ebitY5 * 0.11) },
    { name: 'Order Mgmt', value: Math.round(ebitY5 * 0.09) },
    { name: 'Billing', value: Math.round(ebitY5 * 0.07) },
    { name: 'Collections', value: Math.round(ebitY5 * 0.05) },
  ];

  const quickWinsEbit = [
    { name: 'Invoice Proc.', value: Math.round(ebitY5 * 0.35) },
    { name: 'Purchasing', value: Math.round(ebitY5 * 0.28) },
    { name: 'Sourcing', value: Math.round(ebitY5 * 0.22) },
    { name: 'Contract', value: Math.round(ebitY5 * 0.15) },
  ];

  const quickWinsCost = [
    { name: 'Invoice Proc.', value: Math.round(costSavingsY5 * 0.38) },
    { name: 'Purchasing', value: Math.round(costSavingsY5 * 0.30) },
    { name: 'Sourcing', value: Math.round(costSavingsY5 * 0.20) },
    { name: 'Contract', value: Math.round(costSavingsY5 * 0.12) },
  ];

  return (
    <div className="space-y-4">
      {/* Top Row */}
      <div className="grid grid-cols-3 gap-4">
        {/* KPI Panel */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">Key Performance Indicators</div>
          <div className="p-3 space-y-3">
            {/* Main KPI */}
            <div className="flex gap-3">
              <div className="flex-1 bg-[#00338D]/5 rounded p-3">
                <div className="text-xs text-gray-500 uppercase tracking-wide">EBIT INCREASE Y5</div>
                <div className="text-3xl font-bold text-[#00338D]">{formatK(ebitY5)}</div>
                <div className="text-xs text-green-600">↑ +{roiY5}%</div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="border border-gray-200 rounded p-2">
                  <div className="text-xs text-gray-400 uppercase">Revenue Run Rate Y5</div>
                  <div className="font-bold text-[#00338D] text-sm">{formatK(revenueY5)}</div>
                </div>
                <div className="border border-gray-200 rounded p-2">
                  <div className="text-xs text-gray-400 uppercase">Cost Savings Y5</div>
                  <div className="font-bold text-[#00338D] text-sm">{formatK(costSavingsY5)}</div>
                </div>
                <div className="border border-gray-200 rounded p-2">
                  <div className="text-xs text-gray-400 uppercase">Run Costs Y5</div>
                  <div className="font-bold text-[#00338D] text-sm">{formatK(runCostsY5)}</div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-gray-200 rounded p-2 text-center">
                <div className="text-xs text-gray-400 uppercase leading-tight">Break-Even (Years)</div>
                <div className="font-bold text-[#00338D]">{breakEven}</div>
              </div>
              <div className="border border-gray-200 rounded p-2 text-center">
                <div className="text-xs text-gray-400 uppercase leading-tight">Invest (Cum)</div>
                <div className="font-bold text-[#00338D]">{formatK(investCum)}</div>
              </div>
              <div className="border border-gray-200 rounded p-2 text-center">
                <div className="text-xs text-gray-400 uppercase leading-tight">ROI Y5</div>
                <div className="font-bold text-[#00338D]">{roiY5}%</div>
              </div>
            </div>
          </div>
        </div>

        {/* Value Distribution */}
        <div className="border border-gray-200 rounded bg-white shadow-sm flex flex-col">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">Value Distribution</div>
          {pieData.length > 0 ? (
            <>
              <div className="px-3 pt-3 flex-1" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ value }) => `€${value}k`}
                      labelLine={false}
                      isAnimationActive={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={`pie-cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`€${v}k`, '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="px-3 pb-3 pt-2 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-1 justify-center text-xs">
                {pieData.map((entry, i) => (
                  <div key={`pie-legend-${i}`} className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="text-gray-700">{entry.name}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-3 h-48 flex items-center justify-center text-gray-400 text-xs text-center">
              Keine Use Cases ausgewählt
            </div>
          )}
        </div>

        {/* AI Use Case Selection */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">AI Use Case Selection</div>
          <div className="overflow-auto" style={{ maxHeight: '240px' }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="text-left px-2 py-1.5 w-6"></th>
                  <th className="text-left px-2 py-1.5">Use Case</th>
                  <th className="text-right px-2 py-1.5">Cost</th>
                  <th className="text-right px-2 py-1.5">Run(Y5)</th>
                  <th className="text-right px-2 py-1.5">Benefits</th>
                  <th className="text-right px-2 py-1.5">NPV</th>
                  <th className="text-right px-2 py-1.5">ROI</th>
                </tr>
              </thead>
              <tbody>
                {availableUseCases.map(uc => {
                  const isSelected = selectedUseCases.includes(uc.id);
                  return (
                    <tr
                      key={uc.id}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-blue-50 ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => toggleUseCase(uc.id)}
                    >
                      <td className="px-2 py-1.5">
                        <input type="checkbox" checked={isSelected} readOnly className="w-3 h-3 accent-[#00338D]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <span className="text-[#00338D]">{ICON_MAP[uc.iconType]}</span>
                          <span className={isSelected ? 'font-semibold' : ''}>{uc.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-600">€{uc.cost}k</td>
                      <td className="px-2 py-1.5 text-right text-gray-600">€{uc.runY5}k</td>
                      <td className="px-2 py-1.5 text-right text-gray-600">€{(uc.benefits / 1000).toFixed(1)}M</td>
                      <td className="px-2 py-1.5 text-right text-gray-600">€{(uc.npv / 1000).toFixed(1)}M</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-[#00338D]">{uc.roi}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Top 10 Levers */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold flex items-center justify-between">
            <span>Top 10 Levers – EBIT Impact Y5 by Process</span>
            <div className="flex gap-1">
              {(['L2', 'L3'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLeverLevel(l)}
                  className={`text-xs px-2 py-0.5 rounded ${leverLevel === l ? 'bg-white text-[#00338D] font-semibold' : 'bg-[#2a4a6b] text-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="p-3" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={leverDataL2} layout="vertical" margin={{ left: 60, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid key="levers-grid" strokeDasharray="3 3" horizontal={false} />
                <XAxis key="levers-xaxis" type="number" tick={{ fontSize: 10 }} tickFormatter={v => `€${v}k`} />
                <YAxis key="levers-yaxis" type="category" dataKey="name" tick={{ fontSize: 10 }} width={70} />
                <Tooltip key="levers-tooltip" formatter={(v: number) => [`€${v}k`, 'EBIT Impact Y5']} />
                <Bar key="levers-bar" dataKey="value" fill="#1d4ed8" radius={[0, 3, 3, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Wins */}
        <div className="border border-gray-200 rounded bg-white shadow-sm">
          <div className="bg-[#00338D] text-white px-3 py-2 text-xs font-semibold">Quick Wins</div>
          <div className="p-3 grid grid-cols-2 gap-4" style={{ height: 220 }}>
            <div>
              <div className="text-xs text-gray-500 mb-1 text-center">EBIT Impact Y2</div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={quickWinsEbit} margin={{ left: -10, right: 5, top: 4, bottom: 30 }}>
                  <CartesianGrid key="qw-ebit-grid" strokeDasharray="3 3" />
                  <XAxis key="qw-ebit-xaxis" dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                  <YAxis key="qw-ebit-yaxis" tick={{ fontSize: 9 }} tickFormatter={v => `€${v}k`} />
                  <Tooltip key="qw-ebit-tooltip" formatter={(v: number) => [`€${v}k`, 'EBIT Y2']} />
                  <Bar key="qw-ebit-bar" dataKey="value" fill="#3b82f6" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1 text-center">Cost Cutting Impact Y2</div>
              <ResponsiveContainer width="100%" height={170}>
                <BarChart data={quickWinsCost} margin={{ left: -10, right: 5, top: 4, bottom: 30 }}>
                  <CartesianGrid key="qw-cost-grid" strokeDasharray="3 3" />
                  <XAxis key="qw-cost-xaxis" dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" />
                  <YAxis key="qw-cost-yaxis" tick={{ fontSize: 9 }} tickFormatter={v => `€${v}k`} />
                  <Tooltip key="qw-cost-tooltip" formatter={(v: number) => [`€${v}k`, 'Cost Cutting Y2']} />
                  <Bar key="qw-cost-bar" dataKey="value" fill="#1d4ed8" isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}