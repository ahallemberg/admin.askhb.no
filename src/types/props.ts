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
  // Named as Organisation names it, because askhb.no renders both through the
  // same LogoMark. Absent means the card shows no mark at all rather than a
  // reserved empty box.
  logoUrl?: string;
  // Optical size correction, as on an organisation. 1 is unscaled.
  logoScale?: number;
  screenshotUrl?: string;
  // The same shot with the site in dark mode, for a site that has one. Absent
  // means the site has no dark variant, or nobody has captured it — askhb.no
  // falls back to screenshotUrl either way, so absent is always safe.
  screenshotUrlDark?: string;
  // Which page the screenshot is taken from, when it should not be the project's
  // own landing page. Stored rather than typed afresh each time so that
  // re-capturing after a redesign cannot silently go back to the front page.
  screenshotSourceUrl?: string;
  // Pulled-out figure, e.g. "680,000" with caption "page views".
  figure?: string;
  figureCaption?: string;
  skills?: string[];
  // Write-ups for the project, in the same shape a role uses. Also what lets
  // pages.askhb.no put this project's mark on its write-up page: that build
  // matches a note by the slug in a link pointing at it.
  links?: PortfolioLink[];
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