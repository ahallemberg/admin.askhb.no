interface PersonalInfo {
  name: string;
  title: string;
  about: string;
  cvUrl?: string;
  // Not what makes the header photo reachable -- every upload overwrites one
  // fixed key, so the site has a photo with or without this. What it carries is
  // the cache-busting query a replacement needs to appear before the bucket's
  // 4 hour max-age expires.
  profilePictureUrl?: string;
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
  // Derived from links[0] so an askhb.no that predates links keeps working.
  readMoreUrl?: string;
  links?: PortfolioLink[];
}

interface Organisation {
  company: string;
  // Joins the date span and commitment in the meta line under the company name. On
  // migrated entries it comes from the legacy company string, which encoded it as
  // "Q-Free - Trondheim" (`splitCompany`); an entry whose company carried no such
  // suffix has none until it is set here.
  location?: string;
  // Derived from the roles' dateRanges, never hand-edited — the same arrangement as
  // date/dateRange one level down, on `roles[]`. There is no `dateRange` here: the
  // structured source is each role's, and `spanOf` reduces them to this string.
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
  // The same shot with the site in dark mode, for a site that has one. Absent
  // means the site has no dark variant, or nobody has captured it — askhb.no
  // falls back to screenshotUrl either way, so absent is always safe.
  screenshotUrlDark?: string;
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