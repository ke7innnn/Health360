/**
 * Universal Age Utility for Health 360
 * Safely parses, normalizes, and calculates patient age from:
 * - Direct strings ("46", "46 years", "46 yrs", "46y", "46 yo")
 * - Dates of Birth ("1980-01-01T00:00:00", "1997-09-02", "15/08/1990")
 * - Missing/invalid values ("N/A", "--", null, undefined)
 */

export function calculateAgeFromDob(dobString: string | Date | null | undefined): string {
  if (!dobString) return '';
  const dob = typeof dobString === 'string' ? new Date(dobString.replace('Z', '')) : dobString;
  if (isNaN(dob.getTime())) return '';

  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  let months = today.getMonth() - dob.getMonth();

  if (today.getDate() < dob.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
  }

  if (years >= 0 && years <= 125) {
    return String(years);
  }
  return '';
}

export function parseOrCalculateAge(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value).trim();
  if (!str) return '';

  const lower = str.toLowerCase();
  if (['n/a', 'na', '--', 'null', 'undefined', 'none', '-'].includes(lower)) {
    return '';
  }

  // 1. If it looks like a Date / DOB string (e.g. 1980-01-01 or 1980/01/01 or ISO string)
  if ((str.includes('-') || str.includes('/') || str.includes('T')) && isNaN(Number(str))) {
    const calculated = calculateAgeFromDob(str);
    if (calculated) return calculated;
  }

  // 2. If it contains a number (e.g. "46 years", "46 yrs", "46y", "46 yo", "46")
  const match = str.match(/\b(\d{1,3})\b/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 0 && num <= 125) {
      return String(num);
    }
  }

  return '';
}

export function formatAgeDisplay(value: any): string {
  const parsed = parseOrCalculateAge(value);
  return parsed ? `${parsed} yrs` : '--';
}
