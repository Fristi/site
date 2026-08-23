export type CvBullet = {
  /** Optional client or project name, shown in bold before the text. */
  lead: string;
  text: string;
};

export type CvExperience = {
  role: string;
  company: string;
  period: string;
  /** Public logo path, empty when none. */
  logo: string;
  /** One-line context for the web CV. */
  summary: string;
  bullets: CvBullet[];
  skills: string[];
};

export type CvLinkItem = {
  date: string;
  name: string;
  description: string;
  url: string;
};

export type CvTechnology = {
  icon: string;
  name: string;
  mastery: number;
  description: string;
};

export type CvTechCategory = {
  category: string;
  detail: string;
};

export type CvCertification = {
  image: string;
  title: string;
  description: string;
};

export type Cv = {
  name: string;
  role: string;
  website: string;
  websiteLabel: string;
  github: string;
  githubLabel: string;
  linkedin: string;
  downloads: {
    pdf: string;
    docx: string;
  };
  introduction: string[];
  experience: CvExperience[];
  talks: CvLinkItem[];
  projects: CvLinkItem[];
  technologies: CvTechnology[];
  techCategories: CvTechCategory[];
  certifications: CvCertification[];
};
