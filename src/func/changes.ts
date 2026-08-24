import type { EducationItem, Organisation, PersonalInfo, PortfolioData, ProjectItem } from '../types/props';
import { deepEqual } from './compare';
import { SECTIONS, type EntryIds, type IdSection } from './entryIds';

/*
 * What is on screen that is not yet in the bucket, said in the words the author
 * used. Drives the count in the header, the badge on each edited section, and the
 * list the Discard prompt shows before throwing it all away.
 *
 * One change is one entry affected, one section reordered, the personal details,
 * or the CV link. An entry edited in five fields counts once: the number answers
 * "how much am I about to publish", which is a question about entries rather than
 * about fields.
 */

type ChangeSection = 'personalInfo' | IdSection;
type ChangeKind = 'added' | 'edited' | 'deleted' | 'reordered';

interface Change {
  section: ChangeSection;
  kind: ChangeKind;
  // The entry's own name, or '' for a change that is not about one entry.
  subject: string;
}

// What each section is called in a sentence, and what one of its entries is.
const SECTION_LABEL: Record<ChangeSection, string> = {
  personalInfo: 'Personal information',
  experiences: 'Experience',
  education: 'Education',
  projects: 'Projects'
};

const nameOf = (section: IdSection, entry: unknown): string => {
  if (section === 'experiences') return (entry as Organisation).company.trim();
  if (section === 'projects') return (entry as ProjectItem).name.trim();
  const education = entry as EducationItem;
  return education.degree.trim() || education.institution.trim();
};

/*
 * The personal details, minus the CV link. cvUrl is owned by CvSection rather
 * than the personal info dialog and reads as its own thing to the author, so it
 * is counted separately from the fields that dialog edits.
 *
 * Written as a removal rather than a list of fields to keep, so a field added to
 * PersonalInfo later is counted without anyone remembering to come back here.
 * The dialog's own editableFieldsOf lists its four explicitly because it builds
 * a draft from them; this only has to notice that something differs.
 */
const detailsOf = (info: PersonalInfo): Partial<PersonalInfo> => {
  const rest: Partial<PersonalInfo> = { ...info };
  delete rest.cvUrl;
  return rest;
};

const byId = <T,>(items: T[], ids: string[]) => {
  const map = new Map<string, T>();
  items.forEach((item, index) => map.set(ids[index], item));
  return map;
};

const diffSection = (
  section: IdSection,
  current: unknown[],
  currentIds: string[],
  saved: unknown[],
  savedIds: string[]
): Change[] => {
  const changes: Change[] = [];
  const before = byId(saved, savedIds);
  const after = byId(current, currentIds);

  savedIds.forEach(id => {
    if (!after.has(id)) {
      changes.push({ section, kind: 'deleted', subject: nameOf(section, before.get(id)) });
    }
  });

  currentIds.forEach(id => {
    const previous = before.get(id);
    const entry = after.get(id);
    if (previous === undefined) {
      changes.push({ section, kind: 'added', subject: nameOf(section, entry) });
    } else if (!deepEqual(previous, entry)) {
      changes.push({ section, kind: 'edited', subject: nameOf(section, entry) });
    }
  });

  /*
   * Order is its own change, and it has to be read off the ids rather than off
   * the fact that a drag happened: the list rebuilds its array on any drop where
   * the indices differ, including one that lands an entry back where it started.
   *
   * Compared over the ids the two sides share, so an add or a delete — which
   * shifts every later position — does not read as a reorder on top of itself.
   */
  const commonBefore = savedIds.filter(id => after.has(id));
  const commonAfter = currentIds.filter(id => before.has(id));
  if (!deepEqual(commonBefore, commonAfter)) {
    changes.push({ section, kind: 'reordered', subject: '' });
  }

  return changes;
};

const describeChanges = (
  current: PortfolioData,
  currentIds: EntryIds,
  saved: PortfolioData,
  savedIds: EntryIds
): Change[] => {
  const changes: Change[] = [];

  if (!deepEqual(detailsOf(current.personalInfo), detailsOf(saved.personalInfo))) {
    changes.push({ section: 'personalInfo', kind: 'edited', subject: '' });
  }

  if (current.personalInfo.cvUrl !== saved.personalInfo.cvUrl) {
    const had = !!saved.personalInfo.cvUrl;
    const has = !!current.personalInfo.cvUrl;
    changes.push({
      section: 'personalInfo',
      kind: has && had ? 'edited' : has ? 'added' : 'deleted',
      subject: 'CV'
    });
  }

  SECTIONS.forEach(section => {
    changes.push(...diffSection(
      section,
      current[section],
      currentIds[section],
      saved[section],
      savedIds[section]
    ));
  });

  return changes;
};

// "2 changed", or "reordered" when moving entries is all that happened — a count
// there would be a number of entries nobody edited.
const badgeFor = (changes: Change[]): string | null => {
  if (changes.length === 0) return null;
  if (changes.every(change => change.kind === 'reordered')) return 'reordered';
  return `${changes.length} changed`;
};

const VERB: Record<ChangeKind, string> = {
  added: 'added',
  edited: 'edited',
  deleted: 'deleted',
  reordered: 'reordered'
};

// One line of the breakdown. Named entries read as the name plus what happened to
// it; the rest name their section instead, because "edited" on its own says
// nothing about which of four files is about to change.
const labelFor = (change: Change): string => {
  if (change.kind === 'reordered') return `${SECTION_LABEL[change.section]} reordered`;
  if (change.section === 'personalInfo') {
    return change.subject === 'CV'
      ? `CV link ${VERB[change.kind]}`
      : 'Personal information edited';
  }
  const name = change.subject || `Untitled ${SECTION_LABEL[change.section].toLowerCase()} entry`;
  return `${name} ${VERB[change.kind]}`;
};

export { SECTION_LABEL, badgeFor, describeChanges, labelFor, type Change, type ChangeSection };
