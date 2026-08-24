import type { PersonalInfo, PortfolioData } from '../types/props';
import { deepEqual } from './compare';

/*
 * Deciding what a restored draft and a bucket that moved underneath it should
 * add up to.
 *
 * PortfolioData's four keys map one to one onto the four PUTs, so the resolution
 * has that granularity already. Per key there are only three cases:
 *
 *   - the draft never touched it        -> take the bucket's, silently
 *   - the draft changed it, nobody else -> keep the draft's, silently
 *   - both changed it                   -> a real conflict, ask
 *
 * Without the per-key split, keeping a draft that edited one file would PUT all
 * four and destroy another session's edits to files this draft never opened.
 */

type FileKey = keyof PortfolioData;

const FILE_KEYS: FileKey[] = ['personalInfo', 'experiences', 'education', 'projects'];

const FILE_NAME: Record<FileKey, string> = {
  personalInfo: 'personalinfo.json',
  experiences: 'experiences.json',
  education: 'education.json',
  projects: 'projects.json'
};

type Resolution = 'bucket' | 'draft' | 'conflict';

interface KeyOutcome {
  key: FileKey;
  resolution: Resolution;
}

const classify = (base: PortfolioData, draft: PortfolioData, loaded: PortfolioData): KeyOutcome[] =>
  FILE_KEYS.map(key => {
    const draftTouched = !deepEqual(base[key], draft[key]);
    const bucketMoved = !deepEqual(base[key], loaded[key]);
    if (!draftTouched) return { key, resolution: 'bucket' as const };
    if (!bucketMoved) return { key, resolution: 'draft' as const };
    return { key, resolution: 'conflict' as const };
  });

/*
 * personalInfo is one file with two independent owners: cvUrl is written by
 * CvSection, while the rest belongs to PersonalInfoDialog. So the likeliest real
 * conflict -- upload a CV on the laptop, edit the About text on the phone -- hits
 * the both-changed case on fields that do not overlap, and resolving it whole
 * would discard one of two compatible edits.
 *
 * The same three cases run per field instead, and the merge is what gets saved.
 * This is the reasoning PersonalInfoDialog already follows one level down, where
 * it merges its four fields over the stored object precisely so it cannot write
 * back a stale cvUrl.
 *
 * The three arrays cannot be merged this way -- they are positional, and there is
 * no id space shared across sessions to merge on -- so whole-file is right for
 * them. The asymmetry is a decision, not an oversight.
 */
const mergePersonalInfo = (
  base: PersonalInfo,
  draft: PersonalInfo,
  loaded: PersonalInfo
): { merged: PersonalInfo; conflicts: (keyof PersonalInfo)[] } => {
  const fields = new Set<keyof PersonalInfo>([
    ...Object.keys(base),
    ...Object.keys(draft),
    ...Object.keys(loaded)
  ] as (keyof PersonalInfo)[]);

  const merged: PersonalInfo = { ...loaded };
  const conflicts: (keyof PersonalInfo)[] = [];

  fields.forEach(field => {
    const draftTouched = !deepEqual(base[field], draft[field]);
    const bucketMoved = !deepEqual(base[field], loaded[field]);
    if (!draftTouched) return;               // keep the bucket's, already copied
    if (!bucketMoved) {
      (merged[field] as unknown) = draft[field];
      return;
    }
    conflicts.push(field);
  });

  return { merged, conflicts };
};

export { FILE_KEYS, FILE_NAME, classify, mergePersonalInfo, type FileKey, type KeyOutcome, type Resolution };
