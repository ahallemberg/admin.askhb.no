import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import EducationCard from '../components/EducationCard';
import EducationDialog from '../components/EducationDialog';
import ExperienceCard from '../components/ExperienceCard';
import ExperienceDialog from '../components/ExperienceDialog';
import PersonalInfoSection from '../components/PersonalInfoSection';
import CvSection from '../components/CvSection';
import DraggableList from '../components/DraggableList';
import type { EducationItem, PortfolioData, PersonalInfo, ExperienceItem } from '../types/props';
import { fetchFromR2 } from '../func/data';
import { normaliseDate } from '../func/dates';
import { normaliseLinks } from '../func/links';
import { fetchPublishedPages, type PublishedPage } from '../func/pages';
import { deepEqual } from '../func/compare';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT, EXPERIENCE_PATH, EDUCATION_PATH, PERSONAL_INFO_PATH } from '../constants/app';


// Stable blank drafts. A fresh object here would change the dialog's prop identity on
// every render of this component; these never change, and the dialog is instead
// remounted via `key` each time it opens. Frozen because they are shared instances
// that also alias into portfolio.* if you open Add and save without typing: every
// edit path already rebuilds the object and its arrays, and freezing makes that
// self-enforcing instead of an invariant the next reader has to know about.
const BLANK_EXPERIENCE: ExperienceItem = { title: '', company: '', date: '', description: '', skills: [] };
const BLANK_EDUCATION: EducationItem = { degree: '', institution: '', date: '', description: [''] };
Object.freeze(BLANK_EXPERIENCE);
Object.freeze(BLANK_EXPERIENCE.skills);
Object.freeze(BLANK_EDUCATION);
Object.freeze(BLANK_EDUCATION.description);

const PortfolioEditor: React.FC = () => {
    const [portfolio, setPortfolio] = useState<PortfolioData>({
        personalInfo: { name: '', title: '', about: '' },
        experiences: [],
        education: []
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
    // Set when load-time normalisation changed something. Kept separate from isDirty:
    // folding it in would light the indicator on every load and train the user to
    // ignore it, but leaving it unsaid hides a bucket-wide rewrite until some
    // unrelated edit happens to trigger it.
    const [migrationPending, setMigrationPending] = useState(false);
    
    const [experienceDialog, setExperienceDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });
    
    const [educationDialog, setEducationDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });
    
    useEffect(() => {
        const loadPortfolioData = async () => {
            try {
                setIsLoading(true);
                setLoadError(null);
                
                const [personalInfo, experiences, education] = await Promise.all([
                    fetchFromR2<PersonalInfo>(R2_GET_ENDPOINT + PERSONAL_INFO_PATH),
                    fetchFromR2<ExperienceItem[]>(R2_GET_ENDPOINT + EXPERIENCE_PATH),
                    fetchFromR2<EducationItem[]>(R2_GET_ENDPOINT + EDUCATION_PATH)
                ]);
                
                const raw: PortfolioData = { personalInfo, experiences, education };

                // Backfill dateRange and canonicalise the date string for every entry.
                // An entry whose date cannot be parsed comes back untouched.
                const loaded: PortfolioData = {
                    personalInfo,
                    experiences: experiences.map(item => normaliseLinks(normaliseDate(item))),
                    education: education.map(normaliseDate)
                };

                setMigrationPending(!deepEqual(raw, loaded));

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
    
    const handleSaveExperience = (experience: ExperienceItem) => {
        const editIndex = experienceDialog.editIndex;
        setPortfolio(prev => ({
            ...prev,
            experiences: editIndex !== undefined
                ? prev.experiences.map((exp, i) => i === editIndex ? experience : exp)
                : [...prev.experiences, experience]
        }));
    };
    
    const handleDeleteExperience = (index: number) => {
        setPortfolio(prev => ({
            ...prev,
            experiences: prev.experiences.filter((_, i) => i !== index)
        }));
    };

    const handleReorderExperiences = (newExperiences: ExperienceItem[]) => {
        setPortfolio(prev => ({
            ...prev,
            experiences: newExperiences
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
                { name: 'education.json', path: EDUCATION_PATH, body: portfolio.education }
            ];

            // allSettled, not all: fetch rejects on a network-level failure, and
            // Promise.all would abandon the other two PUTs mid-flight without
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
                setMigrationPending(false);
                alert('Portfolio saved successfully!');
                console.log('All files saved successfully');
            } else {
                // The three PUTs are independent with no rollback, so a partial failure
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
        <div className="bg-gray-100 min-h-screen font-sans">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <header className="py-8 text-center">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold">Portfolio Editor</h1>
                        <div className="flex items-center gap-4">
                            {isDirty && (
                                <span className="text-sm text-amber-700">Unsaved changes</span>
                            )}
                            {!isDirty && migrationPending && (
                                <span className="text-sm text-gray-500">Date formats will be updated on the next save</span>
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
                                className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
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
                        <div className="text-gray-600">Loading portfolio data...</div>
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
                            {/* Personal Info Section */}
                            <PersonalInfoSection
                                personalInfo={portfolio.personalInfo}
                                onUpdate={handlePersonalInfoChange}
                            />

                            {/* CV Section */}
                            <CvSection
                                personalInfo={portfolio.personalInfo}
                                onUpdate={handlePersonalInfoChange}
                            />
                            
                            {/* Experience Section */}
                            <section className="mb-8">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-2xl font-bold">Experience</h2>
                                    <button
                                        onClick={() => setExperienceDialog({ isOpen: true })}
                                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Experience
                                    </button>
                                </div>
                                
                                <DraggableList
                                    items={portfolio.experiences}
                                    onReorder={handleReorderExperiences}
                                    renderItem={(experience, index, dragHandleProps) => (
                                        <ExperienceCard
                                            experience={experience}
                                            onEdit={() => setExperienceDialog({ isOpen: true, editIndex: index })}
                                            onDelete={() => handleDeleteExperience(index)}
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
                                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
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
                        <ExperienceDialog
                            // Remounts on every open so the draft starts clean; see BLANK_EXPERIENCE above.
                            key={`experience-${experienceDialog.isOpen}-${experienceDialog.editIndex ?? 'new'}`}
                            experience={
                                experienceDialog.editIndex !== undefined
                                    ? portfolio.experiences[experienceDialog.editIndex]
                                    : BLANK_EXPERIENCE
                            }
                            isOpen={experienceDialog.isOpen}
                            isEditing={experienceDialog.editIndex !== undefined}
                            publishedPages={publishedPages}
                            pagesLoadFailed={pagesLoadFailed}
                            onClose={() => setExperienceDialog({ isOpen: false })}
                            onSave={handleSaveExperience}
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