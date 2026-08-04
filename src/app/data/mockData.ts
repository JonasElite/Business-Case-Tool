export interface L2KPI {
  kpi: string;
  q25: string;
  q50: string;
  q75: string;
  unit: string;
}

export interface L3KPI {
  kpi: string;
  l4?: string;
  q25: number;
  q50: number;
  q75: number;
  unit: string;
}

export interface ProcessConfig {
  id: string;
  label: string;
  tabLabel: string;
  flowLabel?: string;
  steps: string[];
  disabledSteps?: string[];
  fteFields: string[];
  l2KPIs: L2KPI[];
  l3KPIs: Record<string, L3KPI[]>;
}

export interface UseCase {
  id: string;
  name: string;
  iconType: string;
  process: 'P2P' | 'O2C' | 'R2R';
  cost: number;
  runY5: number;
  oneTime: number;
  benefits: number;
  npv: number;
  roi: number;
}

export const PROCESSES: Record<string, ProcessConfig> = {
  P2P: {
    id: 'P2P',
    label: 'Procurement-to-Pay (P2P)',
    tabLabel: 'Procurement-to-Pay (P2P)',
    flowLabel: 'Source to Pay (S2P)',
    steps: [
      'Procurement Strategy',
      'Strategic Category Mgmt',
      'Supplier Relationship Mgmt',
      'Strategic Sourcing',
      'Contract Lifecycle Mgmt',
      'Requisitioning',
      'Purchasing',
      'Receiving',
      'Invoice Processing & Payment',
    ],
    disabledSteps: [
      'Procurement Strategy',
      'Strategic Category Mgmt',
      'Supplier Relationship Mgmt',
      'Strategic Sourcing',
      'Contract Lifecycle Mgmt',
    ],
    fteFields: ['Total FTE', 'Purchasing', 'Accounts Payable'],
    l2KPIs: [
      { kpi: 'Total cost to perform the process group P2P as a percentage of cost of goods sold (COGS)', q25: '1.85', q50: '1.20', q75: '0.72', unit: '%' },
      { kpi: 'Total cost to perform the process group P2P as a percentage of revenue', q25: '1.45', q50: '0.95', q75: '0.55', unit: '%' },
      { kpi: 'Total cost to perform the process group P2P per process group FTE', q25: '118,000', q50: '94,500', q75: '76,200', unit: '$ / FTE' },
      { kpi: 'Total cost to perform the process group P2P per purchase order line item', q25: '22.40', q50: '13.80', q75: '7.90', unit: '$' },
      { kpi: 'Number of FTEs that perform the process group "procure materials and services" per $1 billion revenue', q25: '95.0', q50: '62.0', q75: '38.0', unit: 'FTE' },
      { kpi: 'Number of FTEs that perform the process P2P per $1 billion purchases', q25: '108.0', q50: '70.0', q75: '42.0', unit: 'FTE' },
      { kpi: 'Number of FTEs that perform the process P2P per $1 billion revenue', q25: '84.0', q50: '54.0', q75: '32.0', unit: 'FTE' },
      { kpi: 'Ratio of purchases to revenue', q25: '0.42', q50: '0.55', q75: '0.68', unit: 'ratio' },
      { kpi: 'Cycle time in hours to place a purchase order', q25: '48.0', q50: '22.0', q75: '7.5', unit: 'h' },
      { kpi: 'Transaction amount per purchase order', q25: '2,850', q50: '4,500', q75: '7,250', unit: '$' },
    ],
    l3KPIs: {
      'Procurement Strategy': [
        { kpi: 'FTE for category strategy development', q25: 2.5, q50: 1.8, q75: 1.2, unit: 'FTE' },
        { kpi: 'FTE for spend analysis & reporting', q25: 2.0, q50: 1.4, q75: 0.9, unit: 'FTE' },
      ],
      'Strategic Category Mgmt': [
        { kpi: 'FTE for category planning & governance', q25: 2.8, q50: 1.9, q75: 1.2, unit: 'FTE' },
        { kpi: 'FTE for market intelligence', q25: 1.5, q50: 1.0, q75: 0.6, unit: 'FTE' },
      ],
      'Supplier Relationship Mgmt': [
        { kpi: 'FTE for supplier performance monitoring', q25: 3.8, q50: 2.0, q75: 1.9, unit: 'FTE' },
        { kpi: 'FTE for supplier scorecard & reviews', q25: 2.5, q50: 1.8, q75: 1.1, unit: 'FTE' },
        { kpi: 'FTE for supplier onboarding & qualification', q25: 3.0, q50: 2.2, q75: 1.5, unit: 'FTE' },
      ],
      'Strategic Sourcing': [
        { kpi: 'FTE for RFx creation & management', q25: 4.5, q50: 3.2, q75: 2.1, unit: 'FTE' },
        { kpi: 'FTE for bid evaluation & scoring', q25: 3.0, q50: 2.6, q75: 1.7, unit: 'FTE' },
        { kpi: 'FTE for negotiation & award processing', q25: 2.5, q50: 1.8, q75: 1.2, unit: 'FTE' },
      ],
      'Contract Lifecycle Mgmt': [
        { kpi: 'FTE for contract drafting & authoring', q25: 3.5, q50: 2.5, q75: 1.8, unit: 'FTE' },
        { kpi: 'FTE for contract renewal & amendment', q25: 2.8, q50: 2.0, q75: 1.3, unit: 'FTE' },
        { kpi: 'FTE for compliance & obligation tracking', q25: 2.0, q50: 1.6, q75: 0.9, unit: 'FTE' },
      ],
      'Requisitioning': [
        { l4: 'Create Requisition', kpi: 'FTE for requisition creation', q25: 4.0, q50: 3.0, q75: 2.0, unit: 'FTE' },
        { l4: 'Review & Approve Requisition (Incl. Budget Control)', kpi: 'FTE for requisition review & approval', q25: 3.2, q50: 2.4, q75: 1.5, unit: 'FTE' },
        { l4: 'Modify or Cancel Requisition', kpi: 'FTE for requisition modification & cancellation', q25: 1.5, q50: 1.0, q75: 0.6, unit: 'FTE' },
      ],
      'Purchasing': [
        { l4: 'Create purchase order (PO)', kpi: 'FTE for PO creation', q25: 4.2, q50: 2.8, q75: 1.8, unit: 'FTE' },
        { l4: 'Review, approve & distribute purchase', kpi: 'FTE for PO review & distribution', q25: 2.8, q50: 1.9, q75: 1.2, unit: 'FTE' },
        { l4: 'Manage purchase order lifecycle', kpi: 'FTE for PO lifecycle management', q25: 2.4, q50: 1.6, q75: 1.0, unit: 'FTE' },
        { l4: 'Modify or cancel purchase order', kpi: 'FTE for PO modification & cancellation', q25: 1.6, q50: 1.1, q75: 0.7, unit: 'FTE' },
        { l4: 'Expedite Order', kpi: 'FTE for order expediting', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Receiving': [
        { l4: 'Receive advanced shipment notice (ASN)', kpi: 'FTE for ASN processing', q25: 1.6, q50: 1.1, q75: 0.6, unit: 'FTE' },
        { l4: 'Accept/refuse & record receipt of goods/services', kpi: 'FTE for goods receipt processing', q25: 3.5, q50: 2.4, q75: 1.6, unit: 'FTE' },
        { l4: 'Research/resolve exceptions (disputes, warranty, return)', kpi: 'FTE for receipt exception handling', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Invoice Processing & Payment': [
        { l4: 'Receive invoices & credit notes (incl. self billing & prepayments)', kpi: 'FTE for invoice intake', q25: 2.6, q50: 1.8, q75: 1.1, unit: 'FTE' },
        { l4: 'Validate, Approve, & Post Invoices / Credit Notes', kpi: 'FTE for invoice validation & posting', q25: 4.8, q50: 3.2, q75: 1.9, unit: 'FTE' },
        { l4: 'Generate payments file & release payments', kpi: 'FTE for payment execution', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
        { l4: 'Perform bank reconciliations', kpi: 'FTE for bank reconciliation', q25: 1.6, q50: 1.1, q75: 0.6, unit: 'FTE' },
      ],
    },
  },
  O2C: {
    id: 'O2C',
    label: 'Order to Cash (O2C)',
    tabLabel: 'Order-to-Cash (O2C)',
    steps: [
      'Customer Management',
      'Order Management',
      'Credit Management',
      'Fulfillment',
      'Billing & Invoicing',
      'Collections & Dispute',
      'Cash Application',
    ],
    fteFields: ['Total FTE', 'Sales', 'Accounts Receivable'],
    l2KPIs: [
      { kpi: 'Days Sales Outstanding (DSO)', q25: '45', q50: '35', q75: '25', unit: 'days' },
      { kpi: 'Invoice accuracy rate', q25: '92', q50: '96', q75: '99', unit: '%' },
      { kpi: 'Order processing cost per order', q25: '28', q50: '18', q75: '10', unit: '€' },
      { kpi: 'Cash application auto-match rate', q25: '72', q50: '85', q75: '94', unit: '%' },
      { kpi: 'Revenue leakage rate', q25: '2.1', q50: '1.2', q75: '0.5', unit: '%' },
    ],
    l3KPIs: {
      'Customer Management': [
        { kpi: 'FTE for customer master data mgmt', q25: 2.5, q50: 1.7, q75: 1.0, unit: 'FTE' },
        { kpi: 'FTE for customer onboarding', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
      ],
      'Order Management': [
        { kpi: 'FTE for order entry & processing', q25: 3.8, q50: 2.5, q75: 1.6, unit: 'FTE' },
        { kpi: 'FTE for order confirmation & tracking', q25: 2.2, q50: 1.5, q75: 0.9, unit: 'FTE' },
        { kpi: 'FTE for order amendment handling', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Credit Management': [
        { kpi: 'FTE for credit assessment & limit mgmt', q25: 2.8, q50: 2.0, q75: 1.3, unit: 'FTE' },
        { kpi: 'FTE for credit monitoring', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Fulfillment': [
        { kpi: 'FTE for delivery coordination', q25: 3.5, q50: 2.4, q75: 1.5, unit: 'FTE' },
        { kpi: 'FTE for returns processing', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
      ],
      'Billing & Invoicing': [
        { kpi: 'FTE for invoice creation & dispatch', q25: 3.2, q50: 2.1, q75: 1.4, unit: 'FTE' },
        { kpi: 'FTE for billing dispute management', q25: 2.5, q50: 1.8, q75: 1.0, unit: 'FTE' },
        { kpi: 'FTE for credit note processing', q25: 1.5, q50: 1.0, q75: 0.6, unit: 'FTE' },
      ],
      'Collections & Dispute': [
        { kpi: 'FTE for collections management', q25: 4.0, q50: 2.8, q75: 1.9, unit: 'FTE' },
        { kpi: 'FTE for dispute resolution', q25: 3.0, q50: 2.0, q75: 1.3, unit: 'FTE' },
      ],
      'Cash Application': [
        { kpi: 'FTE for payment matching & posting', q25: 2.8, q50: 1.9, q75: 1.2, unit: 'FTE' },
        { kpi: 'FTE for exception handling', q25: 2.2, q50: 1.5, q75: 0.8, unit: 'FTE' },
      ],
    },
  },
  R2R: {
    id: 'R2R',
    label: 'Record to Report (R2R)',
    tabLabel: 'Record-to-Report (R2R)',
    steps: [
      'General Ledger',
      'Fixed Assets',
      'Intercompany',
      'Financial Close',
      'Consolidation',
      'Management Reporting',
      'External Reporting',
    ],
    fteFields: ['Total FTE', 'General Ledger', 'Financial Reporting'],
    l2KPIs: [
      { kpi: 'Days to close (monthly)', q25: '8', q50: '5', q75: '3', unit: 'days' },
      { kpi: 'Journal entry error rate', q25: '3.5', q50: '1.8', q75: '0.7', unit: '%' },
      { kpi: 'Automated journal entry rate', q25: '45', q50: '65', q75: '82', unit: '%' },
      { kpi: 'Account reconciliation time per account', q25: '4.2', q50: '2.5', q75: '1.3', unit: 'hrs' },
      { kpi: 'Report generation cycle time', q25: '5', q50: '3', q75: '1.5', unit: 'days' },
    ],
    l3KPIs: {
      'General Ledger': [
        { kpi: 'FTE for journal entry processing', q25: 3.5, q50: 2.2, q75: 1.4, unit: 'FTE' },
        { kpi: 'FTE for account reconciliation', q25: 4.0, q50: 2.8, q75: 1.7, unit: 'FTE' },
        { kpi: 'FTE for GL maintenance', q25: 1.5, q50: 1.0, q75: 0.6, unit: 'FTE' },
      ],
      'Fixed Assets': [
        { kpi: 'FTE for asset master data maintenance', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
        { kpi: 'FTE for depreciation & amortization', q25: 1.5, q50: 1.0, q75: 0.6, unit: 'FTE' },
      ],
      'Intercompany': [
        { kpi: 'FTE for IC reconciliation', q25: 3.0, q50: 2.0, q75: 1.3, unit: 'FTE' },
        { kpi: 'FTE for IC dispute resolution', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Financial Close': [
        { kpi: 'FTE for close process coordination', q25: 2.8, q50: 1.9, q75: 1.2, unit: 'FTE' },
        { kpi: 'FTE for accruals & adjustments', q25: 3.2, q50: 2.1, q75: 1.3, unit: 'FTE' },
        { kpi: 'FTE for variance analysis', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
      ],
      'Consolidation': [
        { kpi: 'FTE for consolidation processing', q25: 2.5, q50: 1.7, q75: 1.0, unit: 'FTE' },
        { kpi: 'FTE for elimination entries', q25: 1.8, q50: 1.2, q75: 0.7, unit: 'FTE' },
      ],
      'Management Reporting': [
        { kpi: 'FTE for report preparation', q25: 3.8, q50: 2.6, q75: 1.6, unit: 'FTE' },
        { kpi: 'FTE for data validation & QA', q25: 2.5, q50: 1.7, q75: 1.0, unit: 'FTE' },
      ],
      'External Reporting': [
        { kpi: 'FTE for statutory reporting', q25: 2.8, q50: 1.9, q75: 1.2, unit: 'FTE' },
        { kpi: 'FTE for regulatory compliance', q25: 2.0, q50: 1.4, q75: 0.8, unit: 'FTE' },
      ],
    },
  },
};

export const USE_CASES: UseCase[] = [
  { id: 'ai-pip', name: 'AI PIP', iconType: 'package', process: 'P2P', cost: 480, runY5: 290, oneTime: 190, benefits: 2100, npv: 1400, roi: 438 },
  { id: 'ai-pr-creation', name: 'AI PR Creation', iconType: 'file-text', process: 'P2P', cost: 1050, runY5: 640, oneTime: 410, benefits: 3547, npv: 1911, roi: 238 },
  { id: 'order-entry-agent', name: 'Order Entry Agent', iconType: 'inbox', process: 'O2C', cost: 320, runY5: 200, oneTime: 120, benefits: 1600, npv: 1050, roi: 410 },
  { id: 'billing-agent', name: 'Billing Agent', iconType: 'check-circle', process: 'O2C', cost: 290, runY5: 170, oneTime: 120, benefits: 1500, npv: 1000, roi: 420 },
  { id: 'report-generator', name: 'Report Generator', iconType: 'bar-chart', process: 'R2R', cost: 260, runY5: 150, oneTime: 110, benefits: 1300, npv: 880, roi: 380 },
];

export function getFilteredUseCases(selectedProcesses: string[]): UseCase[] {
  if (!selectedProcesses || selectedProcesses.length === 0) return USE_CASES;
  return USE_CASES.filter(uc => selectedProcesses.includes(uc.process));
}

export const SUBPROCESS_COLORS: Record<string, string> = {
  'Procurement Strategy': '#15803d',
  'Strategic Category Mgmt': '#b45309',
  'Supplier Relationship Mgmt': '#15803d',
  'Strategic Sourcing': '#ca8a04',
  'Contract Lifecycle Mgmt': '#b45309',
  'Requisitioning': '#1d4ed8',
  'Purchasing': '#7c3aed',
  'Receiving': '#0f766e',
  'Invoice Processing & Payment': '#b91c1c',
  'Customer Management': '#15803d',
  'Order Management': '#b45309',
  'Credit Management': '#1d4ed8',
  'Fulfillment': '#0f766e',
  'Billing & Invoicing': '#7c3aed',
  'Collections & Dispute': '#b91c1c',
  'Cash Application': '#0369a1',
  'General Ledger': '#15803d',
  'Fixed Assets': '#b45309',
  'Intercompany': '#1d4ed8',
  'Financial Close': '#0f766e',
  'Consolidation': '#7c3aed',
  'Management Reporting': '#b91c1c',
  'External Reporting': '#0369a1',
};

export function generateYearlyData(uc: UseCase) {
  const annualBenefit = uc.benefits / 5;
  const annualRunCost = uc.runY5 / 5;
  const years = [];
  let cumNpv = 0;
  for (let y = 1; y <= 5; y++) {
    const cost = y === 1 ? uc.oneTime + annualRunCost : annualRunCost;
    const benefit = y === 1 ? annualBenefit * 0.5 : annualBenefit;
    const npv = benefit - cost;
    cumNpv += npv;
    years.push({
      year: `Year ${y}`,
      totalCost: -Math.round(cost),
      npv: Math.round(npv),
      cumNpv: Math.round(cumNpv),
    });
  }
  return years;
}

export function generateCumulativeData(uc: UseCase) {
  const monthlyBenefit = uc.benefits / 60;
  const monthlyRunCost = uc.runY5 / 60;
  const points = [];
  for (let m = 0; m <= 60; m += 3) {
    const cumCost = m === 0 ? 0 : -(uc.oneTime + monthlyRunCost * m);
    const cumValue = Math.max(0, monthlyBenefit * (m - 2)) ;
    points.push({
      month: m,
      cumulativeCost: Math.round(cumCost),
      cumulativeValue: Math.round(cumValue),
    });
  }
  return points;
}

export const PHASES = [
  {
    name: 'Phase 1: PoC',
    items: [
      { desc: 'Placeholder – Process Analysis', price: '€2k', unit: 'daily', total: '€35k' },
      { desc: 'Placeholder – Data Assessment', price: '€2k', unit: 'daily', total: '€22k' },
      { desc: 'Placeholder – Stakeholder Workshops', price: '€4k', unit: 'daily', total: '€14k' },
    ],
  },
  {
    name: 'Phase 2: Design/Development',
    items: [
      { desc: 'Placeholder – Solution Design', price: '€3k', unit: 'daily', total: '€50k' },
      { desc: 'Placeholder – Integration Architecture', price: '€3k', unit: 'daily', total: '€21k' },
      { desc: 'Placeholder – Security Review', price: '€2k', unit: 'daily', total: '€8k' },
    ],
  },
  {
    name: 'Phase 3: Implementation',
    items: [
      { desc: 'Placeholder – Development Sprint', price: '€12k', unit: 'monthly', total: '€72k' },
      { desc: 'Placeholder – Testing & QA', price: '€6k', unit: 'monthly', total: '€24k' },
      { desc: 'Placeholder – User Acceptance', price: '€6k', unit: 'weekly', total: '€15k' },
    ],
  },
  {
    name: 'Phase 4: Operation/Running',
    items: [
      { desc: 'Placeholder – Deployment & Rollout', price: '€4k', unit: 'weekly', total: '€20k' },
      { desc: 'Placeholder – Training & Change Mgmt', price: '€3k', unit: 'daily', total: '€41k' },
      { desc: 'Placeholder – Ongoing Operations', price: '€7k', unit: 'monthly', total: '€78k' },
    ],
  },
];
