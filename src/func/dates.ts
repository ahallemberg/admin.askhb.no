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

// "Apr." / "apr" / "April" all resolve to 4. This case-insensitivity is what
// absorbs the lowercase "aug." / "jun." already live in education.json.
function parseMonth(token: string): number | undefined {
  const cleaned = token.trim().replace(/\.$/, '').toLowerCase();
  if (!cleaned) return undefined;
  const index = MONTHS.findIndex(month => {
    const bare = month.replace(/\.$/, '').toLowerCase();
    return cleaned === bare || cleaned.startsWith(bare);
  });
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

// Fills in dateRange and rewrites date into the canonical format. An entry whose
// date cannot be parsed is returned untouched, so a parser gap can never destroy
// a date that was already there.
function normaliseDate<T extends { date: string; dateRange?: DateRange }>(item: T): T {
  const range = item.dateRange ?? parseDateString(item.date);
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

const EMPTY_PICKER_STATE: PickerState = {
  startYear: '',
  startMonth: '',
  endYear: '',
  endMonth: '',
  endMode: 'date',
  yearOnly: false
};

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
  pickerStateFromRange,
  rangeFromPickerState
};
