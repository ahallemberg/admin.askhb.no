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
import type { EducationItem, PortfolioData, PersonalInfo, Organisation, ProjectItem } from '../types/props';
import { fetchPublishedPages, type PublishedPage } from '../func/pages';
import { deepEqual } from '../func/compare';
import { useConfirm } from '../func/confirmContext';
import { EMPTY_IDS, mintIds, withAdded, withOrder, withRemoved, type EntryIds } from '../func/entryIds';
import { badgeFor, describeChanges, labelFor, type Change, type ChangeSection } from '../func/changes';
import { loadPortfolio } from '../func/loadPortfolio';
import { clearDraft, readDraft, writeDraft } from '../func/draftStorage';
import { classify, mergePersonalInfo, FILE_NAME, type FileKey } from '../func/resolveDraft';
import StaleDraftDialog from '../components/StaleDraftDialog';
import Toast from '../components/Toast';
import Notice from '../components/Notice';
import { R2_PUT_ENDPOINT, EXPERIENCE_PATH, EDUCATION_PATH, PERSONAL_INFO_PATH, PROJECTS_PATH } from '../constants/app';


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
    /*
     * What the bucket held when the *current draft* forked, which is not the same
     * question as what it holds now. Collapsing the two is a data-loss bug: a
     * fork point rewritten whenever the draft changes warns once that the bucket
     * moved and then goes quiet, while the draft that would overwrite it is still
     * sitting there.
     *
     * Assigned in exactly five places -- both load branches, a successful save,
     * Discard, and per key when the stale dialog resolves one -- and read
     * everywhere else, the write effect included.
     */
    const [draftBase, setDraftBase] = useState<PortfolioData | null>(null);
    const [failedFiles, setFailedFiles] = useState<string[]>([]);
    // What the restore found, if anything: drives the notice and the resolver.
    const [restored, setRestored] = useState<{ savedAt: number; conflicts: FileKey[]; ownPartialFailure: boolean } | null>(null);
    const [staleOpen, setStaleOpen] = useState(false);
    const [storageBroken, setStorageBroken] = useState(false);
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
    const [saveError, setSaveError] = useState<{ kind: 'partial' | 'total' | 'conflict' | 'refetch-failed'; failed: string[] } | null>(null);
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
        // StrictMode invokes this twice in development. Without the flag both
        // passes reach the restore branch, and the second would race the first
        // through state the first is still deciding.
        let ignore = false;

        const load = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);

                // The same function the pre-save check calls, so the two can
                // never disagree about what "what the bucket holds" means.
                const { loaded, migration: counts } = await loadPortfolio();
                if (ignore) return;

                setMigration(counts);
                setSavedSnapshot(loaded);

                const stored = readDraft();

                // Nothing kept, or what was kept is what the bucket now holds.
                // Identical to the behaviour before drafts existed.
                if (!stored || deepEqual(stored.draft, loaded)) {
                    const ids = mintIds(loaded);
                    setPortfolio(loaded);
                    setDraftBase(loaded);
                    setEntryIds(ids);
                    setSavedEntryIds(ids);
                    clearDraft();
                    return;
                }

                /*
                 * A draft outlived the page. Restore it -- and set draftBase from
                 * the stored fork point, NOT from what was just fetched. Taking
                 * `loaded` here is precisely the rebasing bug: it would erase the
                 * evidence that the draft predates the bucket's current content.
                 */
                setPortfolio(stored.draft);
                setDraftBase(stored.base);
                setEntryIds(stored.draftIds);

                /*
                 * The snapshot's ids have to come from the same minting as the
                 * draft's, or the change count diffs two unrelated id spaces and
                 * reports every entry as deleted-plus-added. baseIds is that
                 * minting; a section the bucket genuinely moved gets fresh ids,
                 * because its entries are not the ones those ids named.
                 */
                const fresh = mintIds(loaded);
                setSavedEntryIds({
                    experiences: deepEqual(stored.base.experiences, loaded.experiences) ? stored.baseIds.experiences : fresh.experiences,
                    education: deepEqual(stored.base.education, loaded.education) ? stored.baseIds.education : fresh.education,
                    projects: deepEqual(stored.base.projects, loaded.projects) ? stored.baseIds.projects : fresh.projects
                });

                // Restored, not merely read for a string: these die with the
                // reload otherwise, and the next write would record saveFailed
                // as false, erasing the only record that the bucket is mixed.
                setSaveFailed(stored.saveFailed);
                setFailedFiles(stored.failedFiles);

                const conflicts = classify(stored.base, stored.draft, loaded)
                    .filter(outcome => outcome.resolution === 'conflict')
                    .map(outcome => outcome.key);

                setRestored({ savedAt: stored.savedAt, conflicts, ownPartialFailure: stored.saveFailed });
                if (conflicts.length > 0) setStaleOpen(true);

            } catch (error) {
                if (ignore) return;
                console.error('Error loading portfolio data:', error);
                setLoadError(error instanceof Error ? error.message : 'Failed to load portfolio data');
                // Storage is deliberately left alone. Clearing here would destroy
                // the work a transient outage was supposed to protect.
            } finally {
                if (!ignore) setIsLoading(false);
            }
        };

        load();
        return () => { ignore = true; };
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
    // True while a draft would overwrite content the bucket no longer holds.
    // Derived, so choosing "decide later" needs no flag to remember it by: the
    // condition simply stays true until a save or a resolution makes it false.
    const isStale = changes.length > 0 && draftBase !== null && savedSnapshot !== null
        && !deepEqual(draftBase, savedSnapshot);

    /*
     * Persist the draft. No debounce: `portfolio` changes only on discrete events
     * -- a dialog's Save, a delete, a reorder, an upload -- because every text
     * field lives in its own dialog's state and never reaches here per keystroke.
     *
     * The dependency list is load-bearing and easy to get wrong. A successful save
     * calls setSavedSnapshot(portfolio) with the *same object reference*, so
     * `portfolio` does not change identity; keyed on it alone this would not
     * re-run and storage would never be cleared after a save. saveFailed and
     * failedFiles matter for the mirror-image reason: a partial failure changes
     * nothing else at all, so without them the envelope never records it.
     */
    useEffect(() => {
        // Until the fetch resolves, `portfolio` is the blank initial value -- the
        // one CLAUDE.md warns must never reach the bucket. It must never be
        // persisted either, or a restore would feed it straight back in.
        if (savedSnapshot === null || savedEntryIds === null || draftBase === null) return;

        // Nothing pending. Kept anyway while the bucket is mixed: saveFailed is
        // React state and dies with the reload, so the envelope is the only thing
        // that can tell the next load about it.
        if (deepEqual(portfolio, savedSnapshot) && !saveFailed) {
            clearDraft();
            return;
        }

        const kept = writeDraft({
            saveFailed,
            failedFiles,
            base: draftBase,
            baseIds: savedEntryIds,
            draft: portfolio,
            draftIds: entryIds
        });
        // Said out loud rather than swallowed: believing you have a backup when
        // you do not is worse than knowing you have none.
        setStorageBroken(!kept);
    }, [portfolio, savedSnapshot, draftBase, entryIds, savedEntryIds, saveFailed, failedFiles]);

    const discardChanges = async () => {
        const confirmed = await confirm({
            title: changes.length === 1 ? 'Discard 1 unsaved change?' : `Discard ${changes.length} unsaved changes?`,
            body: (
                <>
                    <p>
                        The editor goes back to what the bucket held when this page loaded, and the
                        local copy is deleted with it. This cannot be undone.
                    </p>
                    <ul className="mt-3 flex flex-col gap-1.5 border-t border-rule pt-3">
                        {changes.map((change, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${DOT[change.kind]}`} />
                                {labelFor(change)}
                            </li>
                        ))}
                    </ul>
                </>
            ),
            confirmLabel: 'Discard changes'
        });
        if (!confirmed || !savedSnapshot || !savedEntryIds) return;

        setPortfolio(savedSnapshot);
        // Both, or the count is left diffing a restored draft's ids against the
        // ids the bucket's content was minted with.
        setEntryIds(savedEntryIds);
        // Resetting the fork point too is what stops a discarded divergence from
        // leaving a stale warning behind with no draft to justify it.
        setDraftBase(savedSnapshot);
        setRestored(null);
        setToast({ id: Date.now(), message: 'Changes discarded' });
    };

    /*
     * Applying the stale dialog's answers. Every key it resolves -- the ones it
     * asked about and the ones it settled silently -- advances draftBase to what
     * the bucket holds.
     *
     * That looks like the rebasing bug and is its opposite. Rebasing without
     * resolution is what made the warning go quiet while the danger stood;
     * rebasing *on* resolution is what "resolved" means. Leave it out and the
     * resolver deadlocks: the pre-save check would keep finding the difference
     * the dialog just settled, and the file could never be saved.
     */
    const applyResolution = (keep: Record<FileKey, 'draft' | 'bucket'>) => {
        if (!savedSnapshot || !draftBase) return;

        const outcomes = classify(draftBase, portfolio, savedSnapshot);
        const next: PortfolioData = { ...portfolio };

        outcomes.forEach(({ key, resolution }) => {
            const takeBucket = resolution === 'bucket'
                || (resolution === 'conflict' && keep[key] === 'bucket');
            if (key === 'personalInfo') {
                // Field-wise, because this one file has two owners: cvUrl comes
                // from CvSection and the rest from the personal info dialog, so a
                // whole-file choice would discard one of two edits that do not
                // overlap in any field.
                const { merged } = mergePersonalInfo(draftBase.personalInfo, portfolio.personalInfo, savedSnapshot.personalInfo);
                next.personalInfo = resolution === 'conflict' && keep[key] === 'draft'
                    ? { ...merged, ...portfolio.personalInfo }
                    : merged;
                return;
            }
            if (takeBucket) (next[key] as unknown) = savedSnapshot[key];
        });

        setPortfolio(next);
        setDraftBase(savedSnapshot);
        setStaleOpen(false);
        setRestored(null);
    };

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

        /*
         * The safeguard. The load-time check only ever compared against a fetch
         * taken when the page opened, so it is blind to the window that actually
         * loses work: the bucket changing between that load and this save. A tab
         * left open on a laptop while an edit is made from a phone is the ordinary
         * case, not an exotic one.
         *
         * Compared against draftBase rather than savedSnapshot, and that is what
         * makes one check cover both windows. In the ordinary case the two are
         * equal. After a restore they are not: savedSnapshot has already moved on
         * to what this page load fetched, so comparing against it would find no
         * difference and let a stale draft overwrite the bucket anyway.
         */
        if (draftBase) {
            let current: PortfolioData;
            try {
                current = (await loadPortfolio()).loaded;
            } catch (error) {
                // A read that did not succeed is not evidence that writing is
                // safe -- the same reasoning that keeps fetchFromR2OrDefault's
                // fallback narrowed to a 404.
                console.error('Pre-save re-fetch failed:', error);
                setSaveError({ kind: 'refetch-failed', failed: [] });
                setIsSaving(false);
                return;
            }

            const moved = classify(draftBase, portfolio, current)
                .filter(outcome => outcome.resolution === 'conflict')
                .map(outcome => outcome.key);

            if (moved.length > 0) {
                // Nothing is written. The bucket's newer content is adopted as the
                // snapshot so the resolver has something current to reconcile
                // against, and the same dialog the load uses asks about it.
                setSavedSnapshot(current);
                setRestored({ savedAt: Date.now(), conflicts: moved, ownPartialFailure: false });
                setStaleOpen(true);
                setSaveError({ kind: 'conflict', failed: moved.map(key => FILE_NAME[key]) });
                setIsSaving(false);
                return;
            }
        }

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
                // The draft has been published, so what the bucket holds and what
                // the draft forked from are the same thing again.
                setDraftBase(portfolio);
                setFailedFiles([]);
                setRestored(null);
                setSaveFailed(false);
                setMigration(null);
                setToast({ id: Date.now(), message: 'Portfolio saved' });
                console.log('All files saved successfully');
            } else {
                // The four PUTs are independent with no rollback, so a partial failure
                // leaves R2 in a mixed state. Name the files so it is recoverable.
                setSaveFailed(true);
                setFailedFiles(failed);
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
                                onClick={discardChanges}
                                disabled={changes.length === 0}
                                title={changes.length === 0 ? 'Nothing to discard' : undefined}
                                className="rounded-lg border border-rule px-4 py-2 text-sm text-ink-muted transition-colors hover:bg-paper hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Discard
                            </button>
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

                {/* Ordered by how much they need doing something about: what is
                    wrong with the live site first, then what is pending here. */}
                <div className="mb-6 flex flex-col gap-3">
                {saveFailed && !saveError && (
                    <Notice tone="error">
                        <strong className="font-semibold">askhb.no is serving a mix of old and new.</strong>{' '}
                        {failedFiles.length > 0
                            ? `${failedFiles.join(' and ')} did not save.`
                            : 'A save only partly landed.'}{' '}
                        Saving again fixes it.
                    </Notice>
                )}
                {isStale && !staleOpen && (
                    <Notice
                        tone="warning"
                        action={restored && restored.conflicts.length > 0
                            ? { label: 'Resolve', onClick: () => setStaleOpen(true) }
                            : undefined}
                    >
                        <strong className="font-semibold">This draft is older than the bucket.</strong>{' '}
                        Saving it overwrites content edited somewhere else. The bucket keeps no versions.
                    </Notice>
                )}
                {restored && restored.conflicts.length === 0 && (
                    <Notice tone="info" onDismiss={() => setRestored(null)}>
                        Restored unsaved changes from{' '}
                        <strong className="font-semibold">
                            {new Date(restored.savedAt).toLocaleString(undefined, {
                                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                        </strong>. They have not been published yet.
                    </Notice>
                )}
                {storageBroken && (
                    <Notice tone="warning" onDismiss={() => setStorageBroken(false)}>
                        <strong className="font-semibold">This browser will not keep a local copy.</strong>{' '}
                        Unsaved changes will be lost if you refresh — a private window is the usual
                        reason. Save more often until that changes.
                    </Notice>
                )}
                {saveError && (
                    <Notice
                        tone={saveError.kind === 'partial' ? 'error' : 'warning'}
                        // A conflict is answered in the dialog, not by trying the
                        // same save again.
                        action={saveError.kind === 'conflict'
                            ? undefined
                            : { label: 'Retry', onClick: savePortfolio }}
                        onDismiss={() => setSaveError(null)}
                    >
                        {saveError.kind === 'partial' && (
                            <>
                                <strong className="font-semibold">
                                    Saved {4 - saveError.failed.length} of 4 files.
                                </strong>{' '}
                                {saveError.failed.join(' and ')} failed — askhb.no is serving a mix
                                of old and new until you save again.
                            </>
                        )}
                        {saveError.kind === 'total' && (
                            <>
                                <strong className="font-semibold">Nothing was saved.</strong>{' '}
                                The bucket could not be reached, so askhb.no is unchanged. Your draft
                                is kept in this browser and will survive a refresh.
                            </>
                        )}
                        {saveError.kind === 'conflict' && (
                            <>
                                <strong className="font-semibold">Save stopped — the bucket moved.</strong>{' '}
                                {saveError.failed.join(' and ')} changed since this page loaded, so
                                nothing was written. Choose what to keep.
                            </>
                        )}
                        {saveError.kind === 'refetch-failed' && (
                            <>
                                <strong className="font-semibold">Could not check the bucket first.</strong>{' '}
                                Nothing was written, so askhb.no is unchanged. Saving without knowing
                                what is there risks overwriting it, so try again when the connection is back.
                            </>
                        )}
                    </Notice>
                )}
                </div>

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

            {staleOpen && restored && restored.conflicts.length > 0 && (
                <StaleDraftDialog
                    conflicts={restored.conflicts}
                    savedAt={restored.savedAt}
                    ownPartialFailure={restored.ownPartialFailure}
                    onResolve={applyResolution}
                    // Keeps the draft as it stands. Nothing is lost by deciding
                    // later: isStale holds the warning until something resolves it.
                    onDismiss={() => setStaleOpen(false)}
                />
            )}

            {toast && (
                <Toast key={toast.id} message={toast.message} onDismiss={dismissToast} />
            )}
        </div>
    );
};

export default PortfolioEditor;