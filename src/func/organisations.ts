import type { ExperienceItem, Organisation, Role, DateRange } from '../types/props';
import { formatDateRange, normaliseDate } from './dates';
import { normaliseLinks } from './links';

const LOCATION_SEPARATOR = ' - ';

// Live entries encode location in the company string ("Q-Free - Trondheim"). Pulling
// it out is what lets two rows from the same employer group together, and it gives
// askhb.no a location to render separately.
function splitCompany(raw: string): { company: string; location?: string } {
  const index = raw.lastIndexOf(LOCATION_SEPARATOR);
  if (index === -1) {
    return { company: raw.trim() };
  }
  const company = raw.slice(0, index).trim();
  const location = raw.slice(index + LOCATION_SEPARATOR.length).trim();
  // A trailing separator with nothing after it is not a location.
  if (company === '' || location === '') {
    return { company: raw.trim() };
  }
  return { company, location };
}

// Earliest start to latest end across the roles. A single ongoing role makes the
// whole organisation ongoing; an end that is absent without `ongoing` means a
// point date, which contributes a start but no end.
function spanOf(roles: Role[]): DateRange | undefined {
  const ranges = roles.map(role => role.dateRange).filter((r): r is DateRange => !!r);
  if (ranges.length === 0) {
    return undefined;
  }

  const key = (p: { year: number; month?: number }) => p.year * 100 + (p.month ?? 0);

  const start = ranges.reduce((min, r) => (key(r.start) < key(min) ? r.start : min), ranges[0].start);

  if (ranges.some(r => r.ongoing)) {
    return { start, ongoing: true };
  }

  const ends = ranges.map(r => r.end).filter((e): e is { year: number; month?: number } => !!e);
  if (ends.length === 0) {
    return { start };
  }
  const end = ends.reduce((max, e) => (key(e) > key(max) ? e : max), ends[0]);
  return { start, end };
}

// Groups by the split company name, preserving first-appearance order so an
// existing hand-ordered experiences.json keeps its ordering. Roles keep their
// relative order within an organisation, which in the live data is already
// reverse-chronological.
function groupExperiences(items: ExperienceItem[]): Organisation[] {
  const order: string[] = [];
  const byCompany = new Map<string, Organisation>();

  for (const item of items) {
    const { company, location } = splitCompany(item.company);
    const normalised = normaliseLinks(normaliseDate(item));

    const role: Role = {
      title: normalised.title,
      date: normalised.date,
      dateRange: normalised.dateRange,
      description: normalised.description,
      skills: normalised.skills,
      readMoreUrl: normalised.readMoreUrl,
      links: normalised.links
    };

    const existing = byCompany.get(company);
    if (existing) {
      existing.roles.push(role);
      // First entry wins for location; they agree in practice, and an organisation
      // has one.
      if (!existing.location && location) {
        existing.location = location;
      }
    } else {
      order.push(company);
      byCompany.set(company, { company, location, date: '', roles: [role] });
    }
  }

  return order.map(company => {
    const org = byCompany.get(company)!;
    const span = spanOf(org.roles);
    return { ...org, date: span ? formatDateRange(span) : org.roles[0]?.date ?? '' };
  });
}

// Distinguishes an already-migrated file from a legacy flat one. Checked on the
// first element only: the file is written wholesale by this app, so it is never
// mixed.
function isOrganisationArray(value: unknown): value is Organisation[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return typeof value[0] === 'object' && value[0] !== null && Array.isArray((value[0] as { roles?: unknown }).roles);
}

export { splitCompany, spanOf, groupExperiences, isOrganisationArray };
