import { useState, useEffect } from 'react';
import { Plus, Save } from 'lucide-react';
import EducationCard from '../components/EducationCard';
import EducationDialog from '../components/EducationDialog';
import ExperienceCard from '../components/ExperienceCard';
import ExperienceDialog from '../components/ExperienceDialog';
import PersonalInfoSection from '../components/PersonalInfoSection';
import type { EducationItem, PortfolioData, PersonalInfo, ExperienceItem } from '../types/props';


const PortfolioEditor: React.FC = () => {
    const [portfolio, setPortfolio] = useState<PortfolioData>({
        personalInfo: { name: '', title: '', about: '' },
        experiences: [],
        education: []
    });
    
    const [experienceDialog, setExperienceDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });
    
    const [educationDialog, setEducationDialog] = useState<{
        isOpen: boolean;
        editIndex?: number;
    }>({ isOpen: false });
    
    // Load initial data
    useEffect(() => {
        const initialData: PortfolioData = {
            personalInfo: {
                name: "Ask Hallem-Berg",
                title: "Master's student in Computer Science | Deputy Chief Engineer at Ascend | Machine Learning Engineer Intern at Q-Free",
                about: "With a strong passion for technology and programming since the age of 14, I have continuously sought opportunities to develop my skills through both academic and professional pursuits."
            },
            experiences: [
                {
                    title: "Deputy Chief Engineer",
                    company: "Ascend Aerial Robotics Team - Trondheim",
                    date: "Apr. 2024 - today",
                    description: "Responsible for overseeing Ascend's four technical groups. Recruited 21 engineers from a pool of 200+ applicants from NTNU.",
                    readMoreUrl: "https://www.askhb.no",
                    skills: ["Team Leadership", "Project Management", "System Integration", "Recruitment"]
                }
            ],
            education: [
                {
                    degree: "Master of Science in Computer Science",
                    institution: "The Norwegian University of Science and Technology - Trondheim",
                    date: "Aug. 2023 - today",
                    description: ["5-year Engineering Master's program"]
                }
            ]
        };
        setPortfolio(initialData);
    }, []);
    
    // Personal info handlers
    const handlePersonalInfoChange = (field: keyof PersonalInfo, value: string) => {
        setPortfolio(prev => ({
            ...prev,
            personalInfo: { ...prev.personalInfo, [field]: value }
        }));
    };
    
    // Experience handlers
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
    
    // Education handlers
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
    
    // Save portfolio
    const savePortfolio = () => {
        console.log('Portfolio Data:', JSON.stringify(portfolio, null, 2));
        alert('Portfolio saved! Check console for JSON output.');
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
            
            <div>
              {portfolio.experiences.map((exp, index) => (
                <ExperienceCard
                  key={index}
                  experience={exp}
                  onEdit={() => setExperienceDialog({ isOpen: true, editIndex: index })}
                  onDelete={() => handleDeleteExperience(index)}
                />
              ))}
            </div>
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
            
            <div>
              {portfolio.education.map((edu, index) => (
                <EducationCard
                  key={index}
                  education={edu}
                  onEdit={() => setEducationDialog({ isOpen: true, editIndex: index })}
                  onDelete={() => handleDeleteEducation(index)}
                />
              ))}
            </div>
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
      </div>
    </div>
  );
};

export default PortfolioEditor;