/**
 * Format a string with period (.) thousands separators, preserving a comma decimal part.
 * e.g. "500000000" → "500.000.000", "9,6" → "9,6", "28753,32" → "28.753,32"
 */
export function formatThousands(v: string): string {
  // Split on first comma to preserve decimal part (de-DE: comma = decimal separator)
  const commaIdx = v.indexOf(',');
  const intRaw = commaIdx >= 0 ? v.slice(0, commaIdx) : v;
  const decPart = commaIdx >= 0 ? v.slice(commaIdx) : '';

  const digits = intRaw.replace(/[^\d]/g, '');
  if (!digits && !decPart) return '';
  const formatted = digits ? digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
  return formatted + decPart;
}

/**
 * Parse a number string in de-DE format (period = thousands sep, comma = decimal sep).
 * Also handles plain JS decimals like "23.46" (period as decimal, < 3 trailing digits).
 * e.g. "28.753,32" → 28753.32, "500.000.000" → 500000000, "23.46" → 23.46
 */
export function parseFormattedNumber(value: string): number {
  return smartParseDeDE(value);
}

export function smartParseDeDE(value: string): number {
  if (!value) return 0;
  const s = value.trim();
  // If comma present → comma is decimal separator, periods are thousands separators
  if (s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // No comma: if the last period has fewer than 3 digits after it → it's a decimal point
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx >= 0 && s.length - dotIdx - 1 !== 3) {
    const intPart = s.slice(0, dotIdx).replace(/\./g, '');
    return parseFloat(intPart + '.' + s.slice(dotIdx + 1)) || 0;
  }
  // 3 digits after last period → all periods are thousands separators
  return parseFloat(s.replace(/\./g, '')) || 0;
}
