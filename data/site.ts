/**
 * Single source of truth for all portfolio content.
 *
 * Everything the page renders — the bio, the links, the project cards, and the
 * context the AI assistant is grounded in — comes from this file. Edit here, not
 * in the components.
 *
 * Project blurbs and tech stacks below are summarized from each repo's README
 * (github.com/rsheth8). Add a `demo` URL to any project to surface a live-demo
 * link on its card.
 */

export interface Profile {
  name: string;
  tagline: string;
  email: string;
  github: string;
  /** Leave empty string to hide the link until you have a real URL. */
  linkedin: string;
  /** Path under /public (e.g. "/resume.pdf") or full URL. Empty hides it. */
  resume: string;
}

export interface Project {
  /** Display name. */
  name: string;
  /** One-line description shown on the card. */
  blurb: string;
  /** Tech tags rendered as chips. */
  tech: string[];
  /** Repo URL. Empty string hides the link. */
  repo: string;
  /** Live demo URL. Empty string hides the link. */
  demo: string;
}

export interface ProjectGroup {
  /** Section id used for anchors / the AI context. */
  id: "ml-projects" | "infra-projects" | "consumer-projects";
  /** Accent color token (matches tailwind.config.ts). */
  accent: "bass" | "mid" | "high";
  /**
   * The hiring role this section maps to. Used as the section heading, the
   * sticky recruiter nav label, and the per-card role tag — so a recruiter can
   * match projects to an open req at a glance.
   */
  role: string;
  /** Short track-number prefix shown above the heading (keeps the album vibe). */
  track: string;
  /** One-line description under the heading. */
  copy: string;
  projects: Project[];
}

export const profile: Profile = {
  name: "Rahil Sheth",
  tagline:
    "Full-stack systems, machine learning, and the messy bits in between.",
  email: "rahilsheth05@gmail.com",
  github: "https://github.com/rsheth8",
  linkedin: "https://www.linkedin.com/in/rsheth8/",
  resume: "", // TODO: drop a resume.pdf in /public and set "/resume.pdf"
};

export const projectGroups: ProjectGroup[] = [
  {
    id: "ml-projects",
    accent: "bass",
    role: "AI / Machine Learning",
    track: "03",
    copy: "Models and inference — accident-risk scoring, sentiment comparison, and computer vision.",
    projects: [
      {
        name: "MyDrive",
        blurb:
          "Chicagoland route planner that scores every road segment with an XGBoost accident-risk model, then compares up to 8 routes by time, tolls, calm, and safety.",
        tech: ["Python", "XGBoost", "FastAPI", "Streamlit", "OpenStreetMap"],
        repo: "https://github.com/rsheth8/MyDrive",
        demo: "",
      },
      {
        name: "movie-sentiment-comparison",
        blurb:
          "Head-to-head sentiment classification on Rotten Tomatoes — a frozen-embedding PyTorch MLP vs. zero-shot Flan-T5 — with a breakdown of where each one fails.",
        tech: ["PyTorch", "Sentence-Transformers", "Flan-T5", "Jupyter"],
        repo: "https://github.com/rsheth8/movie-sentiment-comparison",
        demo: "",
      },
      {
        name: "Storelytics",
        blurb:
          "Turns one storefront camera into live foot-traffic analytics — entries, dwell time, and inferred demographics via face re-identification and DeepFace.",
        tech: ["Python", "OpenCV", "DeepFace", "Redis", "Firebase"],
        repo: "https://github.com/rsheth8/Storelytics",
        demo: "",
      },
    ],
  },
  {
    id: "infra-projects",
    accent: "mid",
    role: "Data Engineering",
    track: "04",
    copy: "Pipelines, analytics, and the backend systems behind the apps.",
    projects: [
      {
        name: "InfraTrack",
        blurb:
          "Cloud-spend dashboard for engineering teams — per-service AWS tracking, month-to-date budget burn, and threshold email alerts.",
        tech: ["FastAPI", "SQLAlchemy", "Postgres", "React", "Vite"],
        repo: "https://github.com/rsheth8/InfraTrack",
        demo: "",
      },
      {
        name: "SongSift",
        blurb:
          "End-to-end music workbench — extracts audio features with librosa, recommends and clusters tracks, builds a similarity graph, and beat-matches mashups.",
        tech: ["Python", "librosa", "Flask", "React", "TypeScript"],
        repo: "https://github.com/rsheth8/SongSift",
        demo: "",
      },
      {
        name: "ai-slack-bot",
        blurb:
          "Go Slack bot that answers natural-language questions in-channel by routing them through Wit.ai intent extraction and Wolfram Alpha.",
        tech: ["Go", "Slack API", "Wit.ai", "Wolfram Alpha"],
        repo: "https://github.com/rsheth8/ai-slack-bot",
        demo: "",
      },
    ],
  },
  {
    id: "consumer-projects",
    accent: "high",
    role: "Software Engineering",
    track: "05",
    copy: "Full-stack products, web and mobile — shipped end to end for real users.",
    projects: [
      {
        name: "PantryPal",
        blurb:
          "Collaborative pantry app for families and roommates — shared grocery tracking, expiration alerts, recipe matching, and AI meal planning.",
        tech: ["React Native", "Expo", "TypeScript"],
        repo: "https://github.com/rsheth8/PantryPal",
        demo: "",
      },
      {
        name: "Hindsight",
        blurb:
          "A daily investing puzzle — 'chess.com for investing' — that grades your judgment and calibration rather than your luck, with a luck-resistant Elo-style rating.",
        tech: ["Next.js", "TypeScript", "Claude API", "FMP API"],
        repo: "https://github.com/rsheth8/Hindsight",
        demo: "",
      },
      {
        name: "MSAD",
        blurb:
          "An educational stock-analysis dashboard — a 'trading gym' with a grounded AI tutor, a conviction journal, and calibration scoring. Built with Aastik Mishra.",
        tech: ["Next.js", "TypeScript", "Claude API"],
        repo: "https://github.com/rsheth8/MSAD",
        demo: "",
      },
      {
        name: "distill",
        blurb:
          "A Chrome extension that helps you read long articles — progressive AI summaries, comprehension check-ins, and focus tools, with bring-your-own-key AI.",
        tech: ["Chrome Extension (MV3)", "JavaScript", "Groq", "LLM"],
        repo: "https://github.com/rsheth8/distill",
        demo: "",
      },
    ],
  },
];

/** Flat list of every project — handy for the AI context. */
export const allProjects: Project[] = projectGroups.flatMap((g) => g.projects);

/* ------------------------------------------------------------------ */
/*  Skills — rendered as the "Frequency" section's audio EQ.          */
/* ------------------------------------------------------------------ */

export interface SkillGroup {
  /** Category label (the EQ "channel"). */
  label: string;
  /** Hex accent from the music-viz palette — colors the meters + label. */
  color: string;
  /**
   * Which analyser band drives this group's bounce, so each category pulses
   * to its own slice of whatever's playing. See lib/audio/useAudioAnalyser.
   */
  band: "bass" | "lowMid" | "mid" | "highMid" | "high";
  /** Skills in this channel. Edit freely — order is left-to-right. */
  skills: string[];
}

export const skillGroups: SkillGroup[] = [
  {
    label: "Languages",
    color: "#ff3a7a", // bass — magenta
    band: "bass",
    skills: ["Python", "TypeScript", "Go", "Java", "JavaScript", "SQL"],
  },
  {
    label: "AI / ML",
    color: "#b14dff", // accent — violet
    band: "mid",
    skills: ["PyTorch", "scikit-learn", "XGBoost", "OpenCV", "LLM / Claude API"],
  },
  {
    label: "Backend & Data",
    color: "#00d6ff", // mid — cyan
    band: "lowMid",
    skills: ["FastAPI", "Flask", "Node.js", "PostgreSQL", "Redis"],
  },
  {
    label: "Web & Mobile",
    color: "#ffe66c", // high — yellow
    band: "highMid",
    skills: ["React", "Next.js", "React Native", "Tailwind", "Expo"],
  },
  {
    label: "Tools & Cloud",
    color: "#8aa8c8", // ice — cold blue
    band: "high",
    skills: ["Docker", "Git", "Firebase", "AWS", "Vercel"],
  },
];
