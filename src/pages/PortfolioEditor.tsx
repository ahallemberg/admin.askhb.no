import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Save, ChevronDown } from 'lucide-react';
import EducationCard from '../components/EducationCard';
import EducationDialog from '../components/EducationDialog';
import OrganisationCard from '../components/OrganisationCard';
import OrganisationDialog from '../components/OrganisationDialog';
import ProjectCard from '../components/ProjectCard';
import ProjectDialog from '../components/ProjectDialog';
import PersonalInfoCard from '../components/PersonalInfoCard';
import PersonalInfoDialog from '../components/PersonalInfoDialog';
import CvSection from '../components/CvSection';
import DraggableList from '../components/DraggableList';
import type { EducationItem, PortfolioData, PersonalInfo, ExperienceItem, Organisation, ProjectItem } from '../types/props';
import { fetchFromR2, fetchFromR2OrDefault } from '../func/data';
import { normaliseDate } from '../func/dates';
import { groupExperiences, isOrganisationArray } from '../func/organisations';
import { fetchPublishedPages, type PublishedPage } from '../func/pages';
import { deepEqual } from '../func/compare';
import { useConfirm } from '../func/confirmContext';
import { EMPTY_IDS, mintIds, withAdded, withOrder, withRemoved, type EntryIds } from '../func/entryIds';
import { badgeFor, describeChanges, labelFor, type Change, type ChangeSection } from '../func/changes';
import Toast from '../components/Toast';
import Notice from '../components/Notice';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT, EXPERIENCE_PATH, EDUCATION_PATH, PERSONAL_INFO_PATH, PROJECTS_PATH } from '../constants/app';


// Stable blank drafts. A fresh object here would change the dialog's prop identity on
// every render of this component; these never change, and the dialog is instead
// remounted via `key` each time it opens. Frozen because they are shared instances
// that also alias into portfolio.* if you open Add and save without typing: every
// edit path already rebuilds the object and its arrays, and freezing makes that
// self-enforcing instead of an invariant the next reader has to know about.
const BLANK_ORGANISATION: Organisation = {
    company: '',
    date: '',
    // An organisation with no roles renders nothing at all on askhb.no, so a new one
    // starts with an empty role rather than an empty list.
    roles: [{ title: '', date: '', description: '', skills: [] }]
};
const BLANK_EDUCATION: EducationItem = { degree: '', institution: '', date: '', description: [''] };
const BLANK_PROJECT: ProjectItem = { name: '', description: '' };
Object.freeze(BLANK_ORGANISATION);
Object.freeze(BLANK_ORGANISATION.roles);
Object.freeze(BLANK_ORGANISATION.roles[0]);
Object.freeze(BLANK_ORGANISATION.roles[0].skills);
Object.freeze(BLANK_EDUCATION);
Object.freeze(BLANK_EDUCATION.description);
Object.freeze(BLANK_PROJECT);

// Green reads as arrival, red as loss, amber as alteration, and a neutral for a
// move that changed no content. Semantic rather than palette: the theme tokens
// carry the brand, these carry meaning.
const DOT: Record<Change['kind'], string> = {
    added: 'bg-green-700',
    edited: 'bg-amber-700',
    deleted: 'bg-red-600',
    reordered: 'bg-ink-faint'
};

const plural = (count: number, singular: string, pluralForm: string) =>
    `${count} ${count === 1 ? singular : pluralForm}`;

// Spells out what the first save after the date migration will actually rewrite.
const describeMigration = ({ reformatted, structured, regrouped }: { reformatted: number; structured: number; regrouped: number }) => {
    const parts: string[] = [];
    if (reformatted > 0) parts.push(`${plural(reformatted, 'date', 'dates')} will be reformatted`);
    if (structured > 0) parts.push(`${plural(structured, 'entry', 'entries')} will gain structured dates`);
    if (regrouped > 0) parts.push(`${plural(regrouped, 'entry', 'entries')} will be grouped by organisation`);
    const joined = parts.length > 1
        ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
        : parts[0];
    return `${joined} on the next save`;
};

// Sits beside a section heading when that section carries unsaved edits. Says
// how many, except for a section where only the order moved -- counting entries
// nobody edited would be a number that means nothing.
const SectionBadge: React.FC<{ changes: Change[] }> = ({ changes }) => {
    const label = badgeFor(changes);
    if (!label) return null;
    return (
        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11.5px] font-semibold tabular-nums text-amber-800">
            {label}
        </span>
    );
};

const PortfolioEditor: React.FC = () => {
    const confirm = useConfirm();

    // Where focus goes after a confirmed delete: the button that asked is inside
    // the card that just disappeared, so without these focus would fall to the
    // document and the next Tab would restart at the top of the page.
    const addOrganisationRef = useRef<HTMLButtonElement>(null);
    const addProjectRef = useRef<HTMLButtonElement>(null);
    const addEducationRef = useRef<HTMLButtonElement>(null);

    const [portfolio, setPortfolio] = useState<PortfolioData>({
        personalInfo: { name: '', title: '', about: '' },
        experiences: [],
        education: [],
        projects: []
    });

    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Deliberately separate from isLoading/loadError. Save is gated on those, and a
    // pages.askhb.no outage must never be able to block saving the portfolio.
    const [publishedPages, setPublishedPages] = useState<PublishedPage[]>([]);
    const [pagesLoadFailed, setPagesLoadFailed] = useState(false);

    // What is known to be in R2: set after a successful load and after a fully
    // successful save. Anything else on screen means unsaved changes.
    const [savedSnapshot, setSavedSnapshot] = useState<PortfolioData | null>(null);
    /*
     * Identity for entries that carry none, so a rename reads as one edit rather
     * than a delete and an add. Held beside the data, never inside it: these are
     * minted per page load, so an id living on the entry itself would travel into
     * the bucket and into every comparison against it.
     *
     * `savedEntryIds` is the same set as of the last successful save, which is
     * what the two sides of the diff are matched on.
     */
    const [entryIds, setEntryIds] = useState<EntryIds>(EMPTY_IDS);
    const [savedEntryIds, setSavedEntryIds] = useState<EntryIds | null>(null);
    // A failed save leaves R2 mixed even when the user had made no edits, so the
    // editor must keep saying so rather than looking clean because nothing changed.
    const [saveFailed, setSaveFailed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    // The transient acknowledgement of a save that worked. Carries an id because
    // two saves in quick succession produce the same text, and a key that repeats
    // would leave the second toast inheriting the tail of the first one's timer.
    const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
    // The failure that has to outlive a glance: a partial save leaves askhb.no
    // serving a mix, and nothing here can un-publish the half that landed.
    const [saveError, setSaveError] = useState<{ kind: 'partial' | 'total'; failed: string[] } | null>(null);
    // Stable, so Toast's dismissal timer is not restarted by unrelated renders.
    const dismissToast = useCallback(() => setToast(null), []);
    // What load-time normalisation changed, if anything. Kept separate from isDirty:
    // folding it in would light that indicator on every load and train the user to
    // ignore it, but leaving it unsaid hides a bucket-wide rewrite until some
    // unrelated edit happens to trigger it. Self-clearing — once saved, the raw and
    // normalised forms agree on every later load and this never appears again.
    const [migration, setMigration] = useState<{ reformatted: number; structured: number; regrouped: number } | null>(null);

    const [organisationDialog, setOrganisationDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });

    const [educationDialog, setEducationDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });

    const [projectDialog, setProjectDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });

    // No editIndex: there is one personal info object, so this is open or shut.
    const [personalInfoDialog, setPersonalInfoDialog] = useState(false);
    const [showChanges, setShowChanges] = useState(false);
    
    useEffect(() => {
        const loadPortfolioData = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                
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
                setMigration(reformatted > 0 || structured > 0 || regrouped > 0
                    ? { reformatted, structured, regrouped }
                    : null);

                // Snapshot the normalised form, not the raw fetch: otherwise the editor
                // would report unsaved changes the instant it finished loading.
                const ids = mintIds(loaded);
                setSavedSnapshot(loaded);
                setSavedEntryIds(ids);
                setPortfolio(loaded);
                setEntryIds(ids);
                
            } catch (error) {
                console.error('Error loading portfolio data:', error);
                setLoadError(error instanceof Error ? error.message : 'Failed to load portfolio data');
            } finally {
                setIsLoading(false);
            }
        }
        loadPortfolioData();
    }, []);

    useEffect(() => {
        fetchPublishedPages()
            .then(setPublishedPages)
            .catch(error => {
                console.error('Error loading published pages:', error);
                setPagesLoadFailed(true);
            });
    }, []);
    
    const handlePersonalInfoChange = (field: keyof PersonalInfo, value: string) => {
        setPortfolio(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [field]: value }
        }));
    };

    // Merged over whatever the object currently holds rather than replacing it,
    // so cvUrl -- which this dialog does not edit -- survives the save.
    const handleSavePersonalInfo = (fields: Pick<PersonalInfo, 'name' | 'title' | 'about' | 'profilePictureUrl'>) => {
        setPortfolio(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, ...fields }
        }));
    };
    
    const handleSaveOrganisation = (organisation: Organisation) => {
        const editIndex = organisationDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            experiences: editIndex !== undefined
                ? prev.experiences.map((org, i) => i === editIndex ? organisation : org)
                : [...prev.experiences, organisation]
        }));
        // Only the add branch mints. Editing must keep the entry's id, which is
        // what makes a rename one change instead of two.
        if (editIndex === undefined) setEntryIds(prev => withAdded(prev, 'experiences'));
    };

    const handleDeleteOrganisation = async (index: number) => {
        const organisation = portfolio.experiences[index];
        const roles = organisation.roles.length;
        const name = organisation.company.trim();

        const confirmed = await confirm({
            title: name ? `Delete \u201c${name}\u201d?` : 'Delete this organisation?',
            body: (
                <p>
                    This removes the organisation and {plural(roles, 'role', 'roles')} from the
                    draft. Nothing changes on askhb.no until you save.
                </p>
            ),
            confirmLabel: 'Delete',
            fallbackFocus: () => addOrganisationRef.current
        });
        if (!confirmed) return;

        setPortfolio(prev => ({
            ...prev,
            experiences: prev.experiences.filter((_, i) => i !== index)
        }));
        setEntryIds(prev => withRemoved(prev, 'experiences', index));
    };

    const handleReorderOrganisations = (newOrganisations: typeof portfolio.experiences, order: string[]) => {
        setPortfolio(prev => ({
            ...prev,
            experiences: newOrganisations
        }));
        setEntryIds(prev => withOrder(prev, 'experiences', order));
    };

    const handleSaveProject = (project: ProjectItem) => {
        const editIndex = projectDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            projects: editIndex !== undefined
                ? prev.projects.map((item, i) => i === editIndex ? project : item)
                : [...prev.projects, project]
        }));
        if (editIndex === undefined) setEntryIds(prev => withAdded(prev, 'projects'));
    };

    const handleDeleteProject = async (index: number) => {
        const name = portfolio.projects[index].name.trim();

        const confirmed = await confirm({
            title: name ? `Delete \u201c${name}\u201d?` : 'Delete this project?',
            body: <p>This removes the project from the draft. Nothing changes on askhb.no until you save.</p>,
            confirmLabel: 'Delete',
            fallbackFocus: () => addProjectRef.current
        });
        if (!confirmed) return;

        setPortfolio(prev => ({
            ...prev,
            projects: prev.projects.filter((_, i) => i !== index)
        }));
        setEntryIds(prev => withRemoved(prev, 'projects', index));
    };

    const handleReorderProjects = (newProjects: typeof portfolio.projects, order: string[]) => {
        setPortfolio(prev => ({
            ...prev,
            projects: newProjects
        }));
        setEntryIds(prev => withOrder(prev, 'projects', order));
    };
    
    const handleSaveEducation = (education: EducationItem) => {
        const editIndex = educationDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            education: editIndex !== undefined
                ? prev.education.map((edu, i) => i === editIndex ? education : edu)
                : [...prev.education, education]
        }));
        if (editIndex === undefined) setEntryIds(prev => withAdded(prev, 'education'));
    };
    
    const handleDeleteEducation = async (index: number) => {
        const entry = portfolio.education[index];
        const name = entry.degree.trim() || entry.institution.trim();

        const confirmed = await confirm({
            title: name ? `Delete \u201c${name}\u201d?` : 'Delete this education entry?',
            body: <p>This removes the entry from the draft. Nothing changes on askhb.no until you save.</p>,
            confirmLabel: 'Delete',
            fallbackFocus: () => addEducationRef.current
        });
        if (!confirmed) return;

        setPortfolio(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
        setEntryIds(prev => withRemoved(prev, 'education', index));
    };

    const handleReorderEducation = (newEducation: typeof portfolio.education, order: string[]) => {
        setPortfolio(prev => ({
            ...prev,
            education: newEducation
        }));
        setEntryIds(prev => withOrder(prev, 'education', order));
    };
    
    /*
     * The changes themselves, and their per-section tallies. Derived rather than
     * tracked: anything remembered alongside the edits is one more thing that can
     * disagree with them.
     *
     * Computed from the snapshots alone, so `saveFailed` is deliberately not part
     * of it. A partial save leaves the bucket mixed with nothing pending, and a
     * count of zero changes is the honest answer to "what have I edited" — it is
     * the unsaved-changes indicator's job to keep reporting the mixed bucket.
     */
    const changes: Change[] = savedSnapshot && savedEntryIds
        ? describeChanges(portfolio, entryIds, savedSnapshot, savedEntryIds)
        : [];
    const changesBySection = (section: ChangeSection) => changes.filter(change => change.section === section);

    const isDirty = saveFailed || (savedSnapshot !== null && !deepEqual(portfolio, savedSnapshot));

    useEffect(() => {
        if (!isDirty) return;
        const warn = (event: BeforeUnloadEvent) => {
            event.preventDefault();
            // preventDefault alone is enough in current browsers; returnValue is what
            // older Chrome and WebKit actually check.
            event.returnValue = true;
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [isDirty]);

    const savePortfolio = async () => {
        // Never write the empty initial state over the bucket. Without this the
        // editor would PUT blank strings and empty arrays over every entry if it
        // saved before the load finished or after it failed, and R2 keeps no
        // versions to restore from.
        if (isLoading || loadError) {
            return;
        }

        // Without this a double-click issues six PUTs, and the two savePortfolio
        // closures race to set the snapshot.
        if (isSaving) {
            return;
        }

        /*
         * The one save that rewrites content the author never edited: the first
         * one after a load-time migration reformats dates and regroups every
         * experience across the whole bucket. describeMigration already spells out
         * exactly what that will do, so the prompt says it rather than paraphrasing.
         */
        if (migration) {
            const confirmed = await confirm({
                title: 'Save the date migration too?',
                body: (
                    <>
                        <p>Saving rewrites entries you have not edited: {describeMigration(migration)}.</p>
                        <p className="mt-2">
                            This brings the bucket into the shape the editor already reads, and only
                            happens once. The bucket keeps no versions, so the old strings are gone
                            afterwards.
                        </p>
                    </>
                ),
                confirmLabel: 'Save',
                tone: 'warning'
            });
            if (!confirmed) return;
        }

        setIsSaving(true);
        setSaveError(null);

        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-Custom-API-Key': import.meta.env.VITE_WORKER_SHARED_SECRET
            };

            // Name and payload travel together so that reordering these can never make
            // a partial-failure report blame the wrong file.
            const targets = [
                { name: 'personalinfo.json', path: PERSONAL_INFO_PATH, body: portfolio.personalInfo },
                { name: 'experiences.json', path: EXPERIENCE_PATH, body: portfolio.experiences },
                { name: 'education.json', path: EDUCATION_PATH, body: portfolio.education },
                { name: 'projects.json', path: PROJECTS_PATH, body: portfolio.projects }
            ];

            // allSettled, not all: fetch rejects on a network-level failure, and
            // Promise.all would abandon the other three PUTs mid-flight without
            // cancelling them. They can still land, so reporting "nothing was saved"
            // from the catch would be the opposite of the truth.
            const results = await Promise.allSettled(targets.map(target => fetch(R2_PUT_ENDPOINT + target.path, {
                method: 'PUT',
                headers,
                body: JSON.stringify(target.body)
            })));

            const failed = targets
                .filter((_, index) => {
                    const result = results[index];
                    return result.status !== 'fulfilled' || !result.value.ok;
                })
                .map(target => target.name);

            if (failed.length === 0) {
                // Only now does the on-screen state match what is in R2.
                setSavedSnapshot(portfolio);
                setSavedEntryIds(entryIds);
                setSaveFailed(false);
                setMigration(null);
                setToast({ id: Date.now(), message: 'Portfolio saved' });
                console.log('All files saved successfully');
            } else {
                // The four PUTs are independent with no rollback, so a partial failure
                // leaves R2 in a mixed state. Name the files so it is recoverable.
                setSaveFailed(true);
                setSaveError({ kind: 'partial', failed });
                console.error('Some saves failed:', failed, results);
            }
        } catch (error) {
            // allSettled above means only a non-network bug reaches here, but a save
            // that ended this way is still not a save that succeeded.
            setSaveFailed(true);
            setSaveError({ kind: 'total', failed: [] });
            console.error('Save error:', error);
        } finally {
            setIsSaving(false);
        }
    };

    
    return (
        <div className="bg-rule-faint min-h-screen font-sans">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <header className="py-8 text-center">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold">Portfolio Editor</h1>
                        <div className="flex items-center gap-4">
                            {changes.length > 0 && (
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setShowChanges(open => !open)}
                                        aria-expanded={showChanges}
                                        className="flex items-center gap-2 rounded-full border border-amber-200 px-3 py-1 text-sm text-amber-800 tabular-nums transition-colors hover:bg-amber-50"
                                    >
                                        {changes.length === 1 ? '1 unsaved change' : `${changes.length} unsaved changes`}
                                        <ChevronDown className={`w-3 h-3 transition-transform ${showChanges ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showChanges && (
                                        <div className="absolute right-0 top-full z-30 mt-2 min-w-[17rem] rounded-lg border border-rule bg-paper p-4 text-left shadow-xl">
                                            <h3 className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-ink-faint">
                                                Not yet published
                                            </h3>
                                            <ul className="flex flex-col gap-2">
                                                {changes.map((change, index) => (
                                                    <li key={index} className="flex items-start gap-2 text-sm text-ink-muted">
                                                        <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[change.kind]}`} />
                                                        {labelFor(change)}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                            {/* Still says so when a failed save left the bucket mixed with
                                nothing pending, which is exactly when the count is zero. */}
                            {changes.length === 0 && isDirty && (
                                <span className="text-sm text-amber-800">Unsaved changes</span>
                            )}
                            {!isDirty && migration && (
                                <span className="text-sm text-ink-muted">{describeMigration(migration)}</span>
                            )}
                            <button
                                onClick={savePortfolio}
                                // Do NOT add !isDirty here. The pending date migration is
                                // not a user edit, so a dirty-gated button would make it
                                // permanently unreachable.
                                disabled={isLoading || !!loadError || isSaving}
                                title={
                                    isLoading ? 'Waiting for the portfolio to load'
                                        : loadError ? 'Cannot save: the portfolio failed to load'
                                        : isSaving ? 'Saving…'
                                        : undefined
                                }
                                className="flex items-center gap-2 px-6 py-3 bg-ink text-paper rounded-lg hover:bg-ink-muted disabled:bg-ink-faint disabled:cursor-not-allowed transition-colors"
                            >
                                <Save className="w-5 h-5" />
                                {isSaving ? 'Saving…' : 'Save Portfolio'}
                            </button>
                        </div>
                    </div>
                </header>

                {saveError && (
                    <div className="mb-6">
                        <Notice
                            tone="error"
                            action={{ label: 'Retry', onClick: savePortfolio }}
                            onDismiss={() => setSaveError(null)}
                        >
                            {saveError.kind === 'partial' ? (
                                <>
                                    <strong className="font-semibold">
                                        Saved {4 - saveError.failed.length} of 4 files.
                                    </strong>{' '}
                                    {saveError.failed.join(' and ')} failed — askhb.no is serving a mix
                                    of old and new until you save again.
                                </>
                            ) : (
                                <>
                                    <strong className="font-semibold">Nothing was saved.</strong>{' '}
                                    The bucket could not be reached, so askhb.no is unchanged. Check
                                    your connection and try again.
                                </>
                            )}
                        </Notice>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="text-ink-muted">Loading portfolio data...</div>
                    </div>
                )}
                
                {/* Error State */}
                {loadError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-red-800">Error loading portfolio: {loadError}</p>
                    </div>
                )}

                {/* Only render the editor once real data is in. On a load failure
                    the state is still the empty initial value, and showing that as
                    if it were the portfolio invites the user to save over it. */}
                {!isLoading && !loadError && (
                    <>
                        <main className="container mx-auto py-8 max-w-6xl">
                            {/* CV Section */}
                            <CvSection
                                personalInfo={portfolio.personalInfo}
                                onUpdate={handlePersonalInfoChange}
                            />

                            {/* Personal Info Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold">Personal Information</h2>
                                        <SectionBadge changes={changesBySection('personalInfo')} />
                                    </div>
                                </div>

                                <PersonalInfoCard
                                    personalInfo={portfolio.personalInfo}
                                    onEdit={() => setPersonalInfoDialog(true)}
                                />
                            </section>
                            
                            {/* Experience Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold">Experience</h2>
                                        <SectionBadge changes={changesBySection('experiences')} />
                                    </div>
                                    <button
                                        ref={addOrganisationRef}
                                        onClick={() => setOrganisationDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Organisation
                                    </button>
                                </div>

                                <DraggableList
                                    items={portfolio.experiences}
                                    keys={entryIds.experiences}
                                    onReorder={handleReorderOrganisations}
                                    renderItem={(organisation, index, dragHandleProps) => (
                                        <OrganisationCard
                                            organisation={organisation}
                                            onEdit={() => setOrganisationDialog({ isOpen: true, editIndex: index })}
                                            onDelete={() => handleDeleteOrganisation(index)}
                                            dragHandleProps={dragHandleProps}
                                        />
                                    )}
                                />
                            </section>

                            {/* Projects Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold">Projects</h2>
                                        <SectionBadge changes={changesBySection('projects')} />
                                    </div>
                                    <button
                                        ref={addProjectRef}
                                        onClick={() => setProjectDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Project
                                    </button>
                                </div>

                                <DraggableList
                                    items={portfolio.projects}
                                    keys={entryIds.projects}
                                    onReorder={handleReorderProjects}
                                    renderItem={(project, index, dragHandleProps) => (
                                        <ProjectCard
                                            project={project}
                                            onEdit={() => setProjectDialog({ isOpen: true, editIndex: index })}
                                            onDelete={() => handleDeleteProject(index)}
                                            dragHandleProps={dragHandleProps}
                                        />
                                    )}
                                />
                            </section>

                            {/* Education Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold">Education</h2>
                                        <SectionBadge changes={changesBySection('education')} />
                                    </div>
                                    <button
                                        ref={addEducationRef}
                                        onClick={() => setEducationDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Education
                                    </button>
                                </div>
                                
                                <DraggableList
                                    items={portfolio.education}
                                    keys={entryIds.education}
                                    onReorder={handleReorderEducation}
                                    renderItem={(education, index, dragHandleProps) => (
                                        <EducationCard
                                            education={education}
                                            onEdit={() => setEducationDialog({ isOpen: true, editIndex: index })}
                                            onDelete={() => handleDeleteEducation(index)}
                                            dragHandleProps={dragHandleProps}
                                        />
                                    )}
                                />
                            </section>
                        </main>

                        {/* Dialogs */}
                        <PersonalInfoDialog
                            // Remounts on every open so the draft starts from what is
                            // stored, the same reason the other three carry a key.
                            key={`personal-info-${personalInfoDialog}`}
                            personalInfo={portfolio.personalInfo}
                            isOpen={personalInfoDialog}
                            onClose={() => setPersonalInfoDialog(false)}
                            onSave={handleSavePersonalInfo}
                        />

                        <OrganisationDialog
                            // Remounts on every open so the draft starts clean; see
                            // BLANK_ORGANISATION above. Doubly required here: the dialog
                            // mints per-role React keys and holds half-typed skills in
                            // mount-scoped state, and DateRangePicker keeps its own. Drop
                            // this key and all three leak from one edit into the next.
                            key={`organisation-${organisationDialog.isOpen}-${organisationDialog.editIndex ?? 'new'}`}
                            organisation={
                                organisationDialog.editIndex !== undefined
                                    ? portfolio.experiences[organisationDialog.editIndex]
                                    : BLANK_ORGANISATION
                            }
                            isOpen={organisationDialog.isOpen}
                            isEditing={organisationDialog.editIndex !== undefined}
                            publishedPages={publishedPages}
                            pagesLoadFailed={pagesLoadFailed}
                            onClose={() => setOrganisationDialog({ isOpen: false })}
                            onSave={handleSaveOrganisation}
                        />

                        <ProjectDialog
                            // Remounts on every open so the draft starts clean; see BLANK_PROJECT above.
                            key={`project-${projectDialog.isOpen}-${projectDialog.editIndex ?? 'new'}`}
                            project={
                                projectDialog.editIndex !== undefined
                                    ? portfolio.projects[projectDialog.editIndex]
                                    : BLANK_PROJECT
                            }
                            isOpen={projectDialog.isOpen}
                            isEditing={projectDialog.editIndex !== undefined}
                            onClose={() => setProjectDialog({ isOpen: false })}
                            onSave={handleSaveProject}
                        />
                            
                        <EducationDialog
                            // Remounts on every open so the draft starts clean; see BLANK_EDUCATION above.
                            key={`education-${educationDialog.isOpen}-${educationDialog.editIndex ?? 'new'}`}
                            education={
                                educationDialog.editIndex !== undefined
                                    ? portfolio.education[educationDialog.editIndex]
                                    : BLANK_EDUCATION
                            }
                            isOpen={educationDialog.isOpen}
                            isEditing={educationDialog.editIndex !== undefined}
                            onClose={() => setEducationDialog({ isOpen: false })}
                            onSave={handleSaveEducation}
                        />
                    </>
                )}
            </div>

            {toast && (
                <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />
            )}
        </div>
    );
};

export default PortfolioEditor;