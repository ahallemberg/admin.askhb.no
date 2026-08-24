import type { EducationItem, ExperienceItem, Organisation, PersonalInfo, PortfolioData, ProjectItem } from '../types/props';
import { fetchFromR2, fetchFromR2OrDefault } from './data';
import { groupExperiences, isOrganisationArray } from './organisations';
import { normaliseDate } from './dates';
import { R2_GET_ENDPOINT, EXPERIENCE_PATH, EDUCATION_PATH, PERSONAL_INFO_PATH, PROJECTS_PATH } from '../constants/app';

interface MigrationCounts {
  reformatted: number;
  structured: number;
  regrouped: number;
}

/*
 * Fetch the four objects and put them in the shape the editor works in.
 *
 * Lifted out of the load effect so that the editor's initial load and the check
 * that runs before a save are the same code rather than two versions of it. That
 * is not tidiness: the pre-save check compares what the bucket holds now against
 * what the draft forked from, and what it forked from is post-normalisation. A
 * check that fetched raw would differ from it by construction on any bucket with
 * a pending migration -- and since the only way to clear a migration is to save,
 * the save it blocked would be the one that would have fixed it.
 *
 * The comparison is a fixed point because every stage below is pure and
 * idempotent: normaliseDate reuses a valid stored dateRange and re-derives the
 * same string, groupExperiences is skipped once isOrganisationArray holds, and
 * normaliseLinks is pure.
 */
const loadPortfolio = async (): Promise<{ loaded: PortfolioData; migration: MigrationCounts | null }> => {
  // Only projects.json tolerates a 404 — it is the one object that does
  // not exist until this editor first writes it. The other three must
  // keep failing loudly: a 404 from a path typo or a worker routing
  // change would otherwise load empty content that the next Save would
  // write over the real thing.
  const [personalInfo, rawExperiences, education, projects] = await Promise.all([
      fetchFromR2<PersonalInfo>(R2_GET_ENDPOINT + PERSONAL_INFO_PATH),
      fetchFromR2<unknown>(R2_GET_ENDPOINT + EXPERIENCE_PATH),
      fetchFromR2<EducationItem[]>(R2_GET_ENDPOINT + EDUCATION_PATH),
      fetchFromR2OrDefault<ProjectItem[]>(R2_GET_ENDPOINT + PROJECTS_PATH, [])
  ]);

  // Already grouped, or still the flat pre-organisation array? This guard
  // is load-bearing for data integrity, not just shape: groupExperiences
  // rebuilds each role from a fixed set of legacy fields, so running it
  // over already-grouped data would drop result, location, logoUrl,
  // logoScale and commitment, and collapse every multi-role organisation
  // to one role. The file is written wholesale, so it is one shape or the
  // other and testing the first element is enough.
  const alreadyGrouped = isOrganisationArray(rawExperiences);
  // Empty when the file is already grouped, so the count below can read
  // off it directly rather than asking the guard a second time.
  const legacyExperiences = alreadyGrouped ? [] : rawExperiences as ExperienceItem[];
  const organisations: Organisation[] = alreadyGrouped
      ? rawExperiences
      : groupExperiences(legacyExperiences);

  // Backfill dateRange and canonicalise the date string for every entry.
  // An entry whose date cannot be parsed comes back untouched.
  const loaded: PortfolioData = {
      personalInfo,
      experiences: organisations,
      education: education.map(normaliseDate),
      projects
  };

  // Counted, not just flagged: "3 dates will be reformatted" tells the
  // user what a save is about to do to content they cannot otherwise see.
  // Education is still compared positionally; experiences cannot be, now
  // that N entries become M organisations, so the regrouping is reported
  // as its own count instead. groupExperiences runs normaliseDate and
  // normaliseLinks internally, so a regrouping save subsumes both.
  const reformatted = education.filter((item, i) => item.date !== loaded.education[i].date).length;
  const structured = education.filter((item, i) => !item.dateRange && !!loaded.education[i].dateRange).length;
  const regrouped = legacyExperiences.length;
  return {
    loaded,
    migration: reformatted > 0 || structured > 0 || regrouped > 0
      ? { reformatted, structured, regrouped }
      : null
  };
};

export { loadPortfolio, type MigrationCounts };
