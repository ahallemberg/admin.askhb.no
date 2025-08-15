interface PersonalInfo {
  name: string;
  title: string;
  about: string;
}

interface ExperienceItem {
  title: string;
  company: string;
  date: string;
  description: string;
  skills: string[];
  readMoreUrl?: string;
}

interface EducationItem {
  degree: string;
  institution: string;
  date: string;
  description: string[];
}

interface PortfolioData {
  personalInfo: PersonalInfo;
  experiences: ExperienceItem[];
  education: EducationItem[];
}

export type { PersonalInfo, ExperienceItem, EducationItem, PortfolioData };