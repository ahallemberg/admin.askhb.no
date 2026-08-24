import type { PortfolioData } from '../types/props';
import type { EntryIds } from './entryIds';
import { isOrganisationArray } from './organisations';

/*
 * The unsaved draft, kept in this browser so a refresh, a closed tab or a
 * connection that drops mid-save no longer costs the work. The bucket keeps no
 * versions, so before this there was nothing to recover from at all.
 *
 * Access is guarded in both directions, following previewTheme.ts: storage
 * throws outright in some configurations rather than returning null, and an
 * editor that cannot keep a backup is a smaller problem than an editor that
 * will not load.
 */

const STORAGE_KEY = 'askhb-admin-draft';

/*
 * Bumped whenever the shape below changes. A mismatch drops the blob rather than
 * migrating it, which also guarantees a restored draft never re-enters the
 * load-time migration path: what is stored is already grouped and already
 * normalised, and groupExperiences must not run twice.
 */
const VERSION = 1;

interface StoredDraft {
  version: number;
  savedAt: number;
  // The bucket was left mixed by this draft's last save. Carried here because it
  // is React state otherwise, and React state dies with the reload that this
  // whole file exists to survive.
  saveFailed: boolean;
  failedFiles: string[];
  // What R2 held when this draft forked -- not what it holds now. The difference
  // is what lets a later load notice the bucket moved underneath.
  base: PortfolioData;
  baseIds: EntryIds;
  draft: PortfolioData;
  draftIds: EntryIds;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isEntryIds = (value: unknown): value is EntryIds =>
  isObject(value)
  && Array.isArray(value.experiences)
  && Array.isArray(value.education)
  && Array.isArray(value.projects);

/*
 * Validated to the same depth as isOrganisationArray, which tests only the first
 * element -- enough to keep a corrupt blob from reaching render, and no deeper.
 * The editor has no error boundary, so a component throwing while rendering
 * blanks the page rather than showing an error.
 */
const isPortfolioData = (value: unknown): value is PortfolioData => {
  if (!isObject(value)) return false;
  const { personalInfo, experiences, education, projects } = value;
  if (!isObject(personalInfo)) return false;
  if (typeof personalInfo.name !== 'string') return false;
  if (!Array.isArray(experiences) || !Array.isArray(education) || !Array.isArray(projects)) return false;
  // Already-grouped is the only shape this ever writes. A flat legacy array here
  // would mean the blob came from somewhere else, and feeding it onward would
  // put pre-migration data past the guard that exists to catch it.
  if (experiences.length > 0 && !isOrganisationArray(experiences)) return false;
  return true;
};

const readDraft = (): StoredDraft | null => {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (parsed.version !== VERSION) return null;
    if (!isPortfolioData(parsed.draft)) return null;
    if (!isEntryIds(parsed.draftIds) || !isEntryIds(parsed.baseIds)) return null;
    /*
     * `base` is checked only for being an object. It is never rendered and never
     * saved -- it exists to be handed to deepEqual -- so validating it as
     * strictly as `draft` would throw away a good draft over a field nothing
     * reads.
     */
    if (!isObject(parsed.base)) return null;

    return {
      version: VERSION,
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
      saveFailed: parsed.saveFailed === true,
      failedFiles: Array.isArray(parsed.failedFiles)
        ? parsed.failedFiles.filter((name): name is string => typeof name === 'string')
        : [],
      base: parsed.base as unknown as PortfolioData,
      baseIds: parsed.baseIds,
      draft: parsed.draft,
      draftIds: parsed.draftIds
    };
  } catch {
    return null;
  }
};

// Returns whether the draft is actually being kept, so the editor can say so when
// it is not. Reporting success either way would leave the author believing their
// work is safe when nothing is storing it.
const writeDraft = (draft: Omit<StoredDraft, 'version' | 'savedAt'>): boolean => {
  try {
    const envelope: StoredDraft = { ...draft, version: VERSION, savedAt: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
    return true;
  } catch {
    return false;
  }
};

const clearDraft = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to do: the blob outlives this session, and the next load's
    // draft-equals-loaded branch drops it anyway.
  }
};

export { clearDraft, readDraft, writeDraft, type StoredDraft };
