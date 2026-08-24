import type { PortfolioData } from '../types/props';

/*
 * Identity for entries that have none of their own.
 *
 * Organisations, projects and education entries are positional arrays keyed only
 * by fields a person edits. Describing a change by matching on those fields gets
 * the commonest edit wrong: renaming an organisation reads as one delete plus one
 * add, and names an entry that no longer exists. New entries start blank, so two
 * of them match each other. Duplicates are legitimate — two stints at one
 * employer is the shape the organisation model exists to express.
 *
 * So each entry gets an id, minted here and carried alongside the data.
 */

// Index-aligned with the matching array on PortfolioData.
interface EntryIds {
  experiences: string[];
  education: string[];
  projects: string[];
}

type IdSection = keyof EntryIds;

const SECTIONS: IdSection[] = ['experiences', 'education', 'projects'];

/*
 * Random, not a counter. Ids only have to be stable for the life of one page —
 * nothing restores a draft across a reload yet — but a counter restarting at zero
 * would make two independently minted sets *collide* rather than be disjoint, and
 * matching would silently degrade into matching by position wearing a hat. That
 * failure looks like working code, which is the reason to rule it out by
 * construction rather than by remembering.
 */
const freshId = () => crypto.randomUUID();

const mintIds = (portfolio: PortfolioData): EntryIds => ({
  experiences: portfolio.experiences.map(freshId),
  education: portfolio.education.map(freshId),
  projects: portfolio.projects.map(freshId)
});

const EMPTY_IDS: EntryIds = { experiences: [], education: [], projects: [] };

const withAdded = (ids: EntryIds, section: IdSection): EntryIds => ({
  ...ids,
  [section]: [...ids[section], freshId()]
});

const withRemoved = (ids: EntryIds, section: IdSection, index: number): EntryIds => ({
  ...ids,
  [section]: ids[section].filter((_, i) => i !== index)
});

// Reordering takes the permutation from the list itself rather than recomputing
// it: DraggableList applies one splice to both arrays, so they cannot disagree.
const withOrder = (ids: EntryIds, section: IdSection, order: string[]): EntryIds => ({
  ...ids,
  [section]: order
});

/*
 * There is deliberately no `withEdited`. Editing an entry must leave its id
 * alone — that is the whole reason the id exists, and it is what makes a rename
 * read as one edit rather than a delete and an add. The add-or-edit save handlers
 * branch on whether an index was supplied, and only the add branch touches ids.
 */

export {
  EMPTY_IDS,
  SECTIONS,
  freshId,
  mintIds,
  withAdded,
  withOrder,
  withRemoved,
  type EntryIds,
  type IdSection
};
