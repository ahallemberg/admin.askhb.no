import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import EducationCard from '../components/EducationCard';
import EducationDialog from '../components/EducationDialog';
import ExperienceCard from '../components/ExperienceCard';
import ExperienceDialog from '../components/ExperienceDialog';
import PersonalInfoSection from '../components/PersonalInfoSection';
import DraggableList from '../components/DraggableList';
import type { EducationItem, PortfolioData, PersonalInfo, ExperienceItem } from '../types/props';
import { fetchFromR2 } from '../func/data';
import { R2_GET_ENDPOINT, R2_PUT_ENDPOINT, EXPERIENCE_PATH, EDUCATION_PATH, PERSONAL_INFO_PATH } from '../constants/app';


const PortfolioEditor: React.FC = () => {
    const [portfolio, setPortfolio] = useState<PortfolioData>({
        personalInfo: { name: '', title: '', about: '' },
        experiences: [],
        education: []
    });

    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    
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
                
                setPortfolio({
                    personalInfo,
                    experiences,
                    education
                });
                
            } catch (error) {
                console.error('Error loading portfolio data:', error);
                setLoadError(error instanceof Error ? error.message : 'Failed to load portfolio data');
            } finally {
                setIsLoading(false);
            }
        }
        loadPortfolioData();
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
    
    const savePortfolio = async () => {
        try {
            const headers = {
                'Content-Type': 'application/json',
                'X-Custom-API-Key': import.meta.env.VITE_WORKER_SHARED_SECRET
            };

            const saveRequests = [
                fetch(R2_PUT_ENDPOINT + PERSONAL_INFO_PATH, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(portfolio.personalInfo)
                }),
                fetch(R2_PUT_ENDPOINT + EXPERIENCE_PATH, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(portfolio.experiences)
                }),
                fetch(R2_PUT_ENDPOINT + EDUCATION_PATH, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(portfolio.education)
                })
            ];
            
            const responses = await Promise.all(saveRequests);
            
            const failedRequests = responses.filter(response => !response.ok);
            
            if (failedRequests.length === 0) {
                alert('Portfolio saved successfully!');
                console.log('All files saved successfully');
            } else {
                alert(`Failed to save ${failedRequests.length} file(s). Check console for details.`);
                console.error('Some saves failed:', failedRequests);
            }
        } catch (error) {
            alert('Failed to save portfolio. Please check your connection.');
            console.error('Save error:', error);
        }
    };

    // Get default experience/education for dialog
    const getDefaultExperience = (): ExperienceItem => ({
        title: '',
        company: '',
        date: '',
        description: '',
        skills: []
    });
    
    const getDefaultEducation = (): EducationItem => ({
        degree: '',
        institution: '',
        date: '',
        description: ['']
    });
    
    return (
        <div className="bg-gray-100 min-h-screen font-sans">
            <div className="container mx-auto px-4 py-8 max-w-6xl">
                {/* Header */}
                <header className="py-8 text-center">
                    <div className="flex justify-between items-center">
                        <h1 className="text-3xl font-bold">Portfolio Editor</h1>
                        <button
                            onClick={savePortfolio}
                            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                        >
                            <Save className="w-5 h-5" />
                            Save Portfolio
                        </button>
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

                {!isLoading && (
                    <>
                        <main className="container mx-auto py-8 max-w-6xl">
                            {/* Personal Info Section */}
                            <PersonalInfoSection
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
                            experience={
                                experienceDialog.editIndex !== undefined
                                    ? portfolio.experiences[experienceDialog.editIndex]
                                    : getDefaultExperience()
                            }
                            isOpen={experienceDialog.isOpen}
                            isEditing={experienceDialog.editIndex !== undefined}
                            onClose={() => setExperienceDialog({ isOpen: false })}
                            onSave={handleSaveExperience}
                        />
                            
                        <EducationDialog
                            education={
                                educationDialog.editIndex !== undefined
                                    ? portfolio.education[educationDialog.editIndex]
                                    : getDefaultEducation()
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