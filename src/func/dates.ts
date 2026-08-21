import type { DateParts, DateRange } from '../types/props';

// Month abbreviations exactly as they render on askhb.no. "May" is not an
// abbreviation, so it takes no period.
const MONTHS = [
  'Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.',
  'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.'
];

const SEPARATOR = ' - ';
const ONGOING_LABEL = 'today';
const ONGOING_WORDS = ['today', 'present', 'now'];

const FIRST_YEAR = 1980;
const YEARS_AHEAD = 10;

function formatParts(parts: DateParts): string {
  return parts.month ? `${MONTHS[parts.month - 1]} ${parts.year}` : String(parts.year);
}

function formatDateRange(range: DateRange): string {
  const start = formatParts(range.start);
  if (range.ongoing) return start + SEPARATOR + ONGOING_LABEL;
  if (!range.end) return start;
  return start + SEPARATOR + formatParts(range.end);
}

// Every spelling accepted for each month, lowercased and without a trailing period.
// Matching is exact against this table rather than by prefix: a prefix match reads
// "junk 2024" as June and "octopus 2024" as October, which would let normaliseDate
// silently rewrite a junk date into a plausible wrong one instead of leaving it be.
const MONTH_SPELLINGS = [
  ['jan', 'january'],
  ['feb', 'february'],
  ['mar', 'march'],
  ['apr', 'april'],
  ['may'],
  ['jun', 'june'],
  ['jul', 'july'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october'],
  ['nov', 'november'],
  ['dec', 'december']
];

// "Apr." / "apr" / "April" all resolve to 4. This case-insensitivity is what
// absorbs the lowercase "aug." / "jun." already live in education.json.
function parseMonth(token: string): number | undefined {
  const cleaned = token.trim().replace(/\.$/, '').toLowerCase();
  if (!cleaned) return undefined;
  const index = MONTH_SPELLINGS.findIndex(spellings => spellings.includes(cleaned));
  return index === -1 ? undefined : index + 1;
}

function parseParts(text: string): DateParts | null {
  const trimmed = text.trim();

  const yearOnly = /^(\d{4})$/.exec(trimmed);
  if (yearOnly) return { year: Number(yearOnly[1]) };

  const monthYear = /^([A-Za-z.]+)\s+(\d{4})$/.exec(trimmed);
  if (!monthYear) return null;

  const month = parseMonth(monthYear[1]);
  if (!month) return null;

  return { year: Number(monthYear[2]), month };
}

// Returns null for anything it does not fully understand. Callers must leave the
// original string alone in that case rather than writing a guess over it.
function parseDateString(date: string): DateRange | null {
  const trimmed = date.trim();
  if (!trimmed) return null;

  const segments = trimmed.split('-');
  if (segments.length > 2) return null;

  const start = parseParts(segments[0]);
  if (!start) return null;

  if (segments.length === 1) return { start };

  const endText = segments[1].trim();
  if (ONGOING_WORDS.includes(endText.toLowerCase())) return { start, ongoing: true };

  const end = parseParts(endText);
  if (!end) return null;

  // Mixed precision ("2019 - Sep. 2023") is deliberately unsupported.
  if ((start.month === undefined) !== (end.month === undefined)) return null;

  return { start, end };
}

function yearOptions(): number[] {
  const last = new Date().getFullYear() + YEARS_AHEAD;
  const years: number[] = [];
  for (let year = last; year >= FIRST_YEAR; year--) years.push(year);
  return years;
}

function isValidParts(parts: DateParts | undefined): boolean {
  if (!parts) return false;
  if (!Number.isInteger(parts.year) || parts.year < 1000 || parts.year > 9999) return false;
  if (parts.month === undefined) return true;
  return Number.isInteger(parts.month) && parts.month >= 1 && parts.month <= 12;
}

// Nothing validates the JSON coming out of R2, and dateRange is trusted ahead of the
// date string — so an out-of-range month reaching formatDateRange would render as
// "undefined 2020" and the first Save would persist that over a perfectly good date.
// Checking it here makes normaliseDate self-healing: a malformed dateRange is ignored
// and the date string is reparsed instead.
function isValidRange(range: DateRange): boolean {
  if (!isValidParts(range.start)) return false;
  if (!range.end) return true;
  if (!isValidParts(range.end)) return false;
  // Mixed precision is unsupported, so a stored range claiming it is malformed.
  return (range.start.month === undefined) === (range.end.month === undefined);
}

// True when the range runs backwards. Surfaced as a warning rather than rejected —
// it is a typo, not corruption, and the stored value stays readable either way.
function isBackwards(range: DateRange): boolean {
  if (!range.end) return false;
  return (range.end.year * 12 + (range.end.month ?? 1)) < (range.start.year * 12 + (range.start.month ?? 1));
}

// Fills in dateRange and rewrites date into the canonical format. An entry whose
// date cannot be parsed is returned untouched, so a parser gap can never destroy
// a date that was already there.
function normaliseDate<T extends { date: string; dateRange?: DateRange }>(item: T): T {
  const stored = item.dateRange;
  const range = stored && isValidRange(stored) ? stored : parseDateString(item.date);
  if (!range) return item;
  return { ...item, dateRange: range, date: formatDateRange(range) };
}

type EndMode = 'date' | 'ongoing' | 'none';

// The picker's raw select values. Every field is a string because an unset
// <select> reads as the empty string, and a half-filled picker is a legal state.
interface PickerState {
  startYear: string;
  startMonth: string;
  endYear: string;
  endMonth: string;
  endMode: EndMode;
  yearOnly: boolean;
}

// Handed out directly by pickerStateFromRange, so frozen: `update` builds a fresh
// object today, but one Object.assign(state, patch) away this would corrupt every
// picker in the session.
const EMPTY_PICKER_STATE: PickerState = Object.freeze({
  startYear: '',
  startMonth: '',
  endYear: '',
  endMonth: '',
  endMode: 'date' as const,
  yearOnly: false
});

function pickerStateFromRange(range: DateRange | undefined): PickerState {
  if (!range) return EMPTY_PICKER_STATE;

  const endMode: EndMode = range.ongoing ? 'ongoing' : range.end ? 'date' : 'none';

  return {
    startYear: String(range.start.year),
    startMonth: range.start.month ? String(range.start.month) : '',
    endYear: range.end ? String(range.end.year) : '',
    endMonth: range.end?.month ? String(range.end.month) : '',
    endMode,
    yearOnly: range.start.month === undefined
  };
}

// Returns null while the picker is still incomplete. Callers treat null as "leave
// the existing date alone", never as "clear it".
function rangeFromPickerState(state: PickerState): DateRange | null {
  if (!state.startYear) return null;
  if (!state.yearOnly && !state.startMonth) return null;

  const start: DateParts = state.yearOnly
    ? { year: Number(state.startYear) }
    : { year: Number(state.startYear), month: Number(state.startMonth) };

  if (state.endMode === 'ongoing') return { start, ongoing: true };
  if (state.endMode === 'none') return { start };

  if (!state.endYear) return null;
  if (!state.yearOnly && !state.endMonth) return null;

  const end: DateParts = state.yearOnly
    ? { year: Number(state.endYear) }
    : { year: Number(state.endYear), month: Number(state.endMonth) };

  return { start, end };
}

export type { PickerState };
export {
  MONTHS,
  formatDateRange,
  parseDateString,
  yearOptions,
  normaliseDate,
  isBackwards,
  pickerStateFromRange,
  rangeFromPickerState
};
