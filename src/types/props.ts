interface PersonalInfo {
  name: string;
  title: string;
  about: string;
  cvUrl?: string;
}

interface DateParts {
  year: number;
  month?: number;   // 1-12; absent means year-only precision
}

interface DateRange {
  start: DateParts;
  end?: DateParts;    // absent with ongoing unset means a single date, no end
  ongoing?: boolean;  // renders the end as "today"
}

interface ExperienceItem {
  title: string;
  company: string;
  date: string;
  dateRange?: DateRange;
  description: string;
  skills: string[];
  readMoreUrl?: string;
}

interface EducationItem {
  degree: string;
  institution: string;
  date: string;
  dateRange?: DateRange;
  description: string[];
}

interface PortfolioData {
  personalInfo: PersonalInfo;
  experiences: ExperienceItem[];
  education: EducationItem[];
}

interface DragHandleProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
}

export type { PersonalInfo, ExperienceItem, EducationItem, PortfolioData, DragHandleProps, DateParts, DateRange };