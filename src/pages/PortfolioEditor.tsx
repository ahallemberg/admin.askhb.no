import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
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

const PortfolioEditor: React.FC = () => {
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
    // A failed save leaves R2 mixed even when the user had made no edits, so the
    // editor must keep saying so rather than looking clean because nothing changed.
    const [saveFailed, setSaveFailed] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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
                setSavedSnapshot(loaded);
                setPortfolio(loaded);
                
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
    };

    const handleDeleteOrganisation = (index: number) => {
        setPortfolio(prev => ({
            ...prev,
            experiences: prev.experiences.filter((_, i) => i !== index)
        }));
    };

    const handleReorderOrganisations = (newOrganisations: Organisation[]) => {
        setPortfolio(prev => ({
            ...prev,
            experiences: newOrganisations
        }));
    };

    const handleSaveProject = (project: ProjectItem) => {
        const editIndex = projectDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            projects: editIndex !== undefined
                ? prev.projects.map((item, i) => i === editIndex ? project : item)
                : [...prev.projects, project]
        }));
    };

    const handleDeleteProject = (index: number) => {
        setPortfolio(prev => ({
            ...prev,
            projects: prev.projects.filter((_, i) => i !== index)
        }));
    };

    const handleReorderProjects = (newProjects: ProjectItem[]) => {
        setPortfolio(prev => ({
            ...prev,
            projects: newProjects
        }));
    };
    
    const handleSaveEducation = (education: EducationItem) => {
        const editIndex = educationDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            education: editIndex !== undefined
                ? prev.education.map((edu, i) => i === editIndex ? education : edu)
                : [...prev.education, education]
        }));
    };
    
    const handleDeleteEducation = (index: number) => {
        setPortfolio(prev => ({
            ...prev,
            education: prev.education.filter((_, i) => i !== index)
        }));
    };

    const handleReorderEducation = (newEducation: EducationItem[]) => {
        setPortfolio(prev => ({
            ...prev,
            education: newEducation
        }));
    };
    
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
        setIsSaving(true);

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
                setSaveFailed(false);
                setMigration(null);
                alert('Portfolio saved successfully!');
                console.log('All files saved successfully');
            } else {
                // The four PUTs are independent with no rollback, so a partial failure
                // leaves R2 in a mixed state. Name the files so it is recoverable.
                setSaveFailed(true);
                alert(`Failed to save: ${failed.join(', ')}. R2 is now in a mixed state — fix the problem and save again.`);
                console.error('Some saves failed:', failed, results);
            }
        } catch (error) {
            // allSettled above means only a non-network bug reaches here, but a save
            // that ended this way is still not a save that succeeded.
            setSaveFailed(true);
            alert('Failed to save portfolio. Please check your connection.');
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
                            {isDirty && (
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
                                    <h2 className="text-2xl font-bold">Personal Information</h2>
                                </div>

                                <PersonalInfoCard
                                    personalInfo={portfolio.personalInfo}
                                    onEdit={() => setPersonalInfoDialog(true)}
                                />
                            </section>
                            
                            {/* Experience Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold">Experience</h2>
                                    <button
                                        onClick={() => setOrganisationDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Organisation
                                    </button>
                                </div>

                                <DraggableList
                                    items={portfolio.experiences}
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
                                    <h2 className="text-2xl font-bold">Projects</h2>
                                    <button
                                        onClick={() => setProjectDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Project
                                    </button>
                                </div>

                                <DraggableList
                                    items={portfolio.projects}
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
                                    <h2 className="text-2xl font-bold">Education</h2>
                                    <button
                                        onClick={() => setEducationDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-ink-muted hover:text-ink transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Education
                                    </button>
                                </div>
                                
                                <DraggableList
                                    items={portfolio.education}
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
        </div>
    );
};

export default PortfolioEditor;