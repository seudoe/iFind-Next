export interface DateRange {
  start: Date;
  end?: Date; 
  isCurrent: boolean;
}

export interface Skill {
  field: string; // e.g., "Backend Development"
  yearsOfExperience: number;
  lastUsed: Date;
  tools: {
    name: string;
    score?: number | null; // Optional numeric 0-100
  }[];
}

export interface Project {
  title: string;
  role: string;
  links: { repo: string; live?: string; demo?: string };
  techStack: string[];
  problemStatement: string | null;  // can be same as title
  metrics: string[];
  technicalChallenges: string[];
  description: string[];    // points about project
  architecture: string;
}

export interface WorkHistory {
  title: string;
  company: string;
  location: string;
  type: 'job' | 'internship' | 'volunteer' | 'co-op';
  period: DateRange;
  responsibilities: string[];   // points  
  achievements: string[];
}

export interface Education {
    institution: string;
    field: {
        type: string; // e.g., "B.S."
        course: string; // e.g., "Computer Science"
    };
    period: DateRange;
    output: string; // GPA, honors, or thesis
}

export interface Publication {  // publications can be written in projects if it has points to be mentioned
  title: string;
  platform: string; // e.g., "Medium", "IEEE", "PyCon"
  type: 'paper' | 'article' | 'talk';
  link: string;
  keywords: string[];
  date: Date;
}

export interface Affiliation {
  organization: string;
  role: string;
  type: string; // e.g., "Open Source", "Professional Body"
  impact: string[];
  period: DateRange;
}

export interface Award {
  name: string;
  issuingBody: string;
  date: Date;
  justification: string;
}

export interface Resume {
  summary: string;    // overview / about me / summary - if mentioned in resume
  workHistory: WorkHistory[];
  education: Education[];
  skills: Skill[]; // Merged Interface
  projects: Project[];
  certifications: {   // course and other certificates
    name: string;
    issuer: string;
    skillsEarned: string[];
    type: string;
    date: Date;
  }[];
  languages: {
    lang: string;
    proficiency: string;
    score?: string;
  }[];
  publications: Publication[];
  affiliations: Affiliation[];
  awards: Award[];
  interests: {
    activity: string;
    description: string;
    commitmentMetric?: string; // e.g., "10+ years"
  }[];
  metaDetails : {
    name: string;
    phone_no: number;
    email : string;
    github_profile : string | null;  // for those who codes / have github 
    linkedin : string | null;
    address : {
      city : string; country : string;
      postal_code : number;
    }
    extra_links : {
      name : string;
      link : string;
    }[];
  }
}

// sometimes awards are in the form of a certificate - so should be included in awards

