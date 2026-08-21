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

interface PortfolioLink {
  label: string;
  url: string;
}

interface Role {
  title: string;
  date: string;
  dateRange?: DateRange;
  description: string;
  // Rendered by askhb.no as the ruled "Result" line. Optional: entries without a
  // clean headline number leave it unset and the layout closes up.
  result?: string;
  skills: string[];
  readMoreUrl?: string;
  links?: PortfolioLink[];
}

interface Organisation {
  company: string;
  location?: string;
  // Derived from the roles' dateRanges, never hand-edited — same arrangement as
  // date/dateRange on a single entry.
  date: string;
  logoUrl?: string;
  // Optical normalisation. Marks differ in ink coverage, so equal boxes do not give
  // equal visual weight; askhb.no multiplies the rendered mark by this. Default 1.
  logoScale?: number;
  // Free text, e.g. "Volunteer, 25+ hrs/week". Renders beside the date span.
  commitment?: string;
  // Length 1 renders flat on askhb.no; longer nests the roles under the org.
  roles: Role[];
}

interface ProjectItem {
  name: string;
  description: string;
  url?: string;
  screenshotUrl?: string;
  // Pulled-out figure, e.g. "680,000" with caption "page views".
  figure?: string;
  figureCaption?: string;
  skills?: string[];
}

interface ExperienceItem {
  title: string;
  company: string;
  date: string;
  dateRange?: DateRange;
  description: string;
  skills: string[];
  // Derived from links[0] so an askhb.no that predates links keeps working.
  readMoreUrl?: string;
  links?: PortfolioLink[];
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
  experiences: Organisation[];
  education: EducationItem[];
  projects: ProjectItem[];
}

interface DragHandleProps {
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
}

export type { PersonalInfo, ExperienceItem, EducationItem, PortfolioData, DragHandleProps, DateParts, DateRange, PortfolioLink, Role, Organisation, ProjectItem };