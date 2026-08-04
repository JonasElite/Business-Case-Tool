// Formula builder token model + evaluator, shared by the custom use case wizard and renderer.

export type FieldUnit = 'number' | 'currency' | 'percent';

export interface CustomFieldDef {
  id: string;
  name: string;
  unit: FieldUnit;
}

export type FormulaToken =
  | { kind: 'field'; value: string; label: string }   // value = field id
  | { kind: 'num'; value: string; label: string }      // value = numeric literal
  | { kind: 'op'; value: '+' | '-' | '*' | '/'; label: string }
  | { kind: 'lparen'; value: '('; label: string }
  | { kind: 'rparen'; value: ')'; label: string };

export const OP_LABEL: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export function formulaToString(tokens: FormulaToken[]): string {
  if (!tokens || tokens.length === 0) return '—';
  return tokens.map(t => t.label).join(' ');
}

const PRECEDENCE: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };

// Evaluate a token formula against a map of field id → numeric value.
export function evalFormula(tokens: FormulaToken[], values: Record<string, number>): number {
  if (!tokens || tokens.length === 0) return 0;

  // Shunting-yard → RPN
  const output: FormulaToken[] = [];
  const ops: FormulaToken[] = [];
  for (const t of tokens) {
    if (t.kind === 'field' || t.kind === 'num') {
      output.push(t);
    } else if (t.kind === 'op') {
      while (ops.length) {
        const top = ops[ops.length - 1];
        if (top.kind === 'op' && PRECEDENCE[top.value] >= PRECEDENCE[t.value]) {
          output.push(ops.pop()!);
        } else break;
      }
      ops.push(t);
    } else if (t.kind === 'lparen') {
      ops.push(t);
    } else if (t.kind === 'rparen') {
      while (ops.length && ops[ops.length - 1].kind !== 'lparen') output.push(ops.pop()!);
      ops.pop(); // discard the matching '('
    }
  }
  while (ops.length) output.push(ops.pop()!);

  // Evaluate RPN
  const stack: number[] = [];
  for (const t of output) {
    if (t.kind === 'num') {
      stack.push(parseFloat(t.value) || 0);
    } else if (t.kind === 'field') {
      stack.push(values[t.value] ?? 0);
    } else if (t.kind === 'op') {
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      stack.push(
        t.value === '+' ? a + b :
        t.value === '-' ? a - b :
        t.value === '*' ? a * b :
        b !== 0 ? a / b : 0,
      );
    }
  }
  return stack.length ? stack[stack.length - 1] : 0;
}

// Canonical value drivers that map to the Deep Dive value-driver columns.
export const VALUE_DRIVER_OPTIONS = [
  'Automation-driven cost savings',
  'FTE Costs Savings',
  'Working Capital Optimization',
  'Carry-over Effect',
  'Material Cost Reduction',
  'Profit Assurance',
];
