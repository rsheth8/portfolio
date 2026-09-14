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
  /** Short project type shown above the name. */
  label: string;
  /** One-line description shown on the card. */
  blurb: string;
  /** Concrete scale, capability, or delivery signal shown on the card. */
  proof: string;
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
    copy: "Reproducible research, risk models, computer vision, and grounded retrieval — with evaluation in the loop.",
    projects: [
      {
        name: "Human–AI Discovery",
        label: "Research simulation",
        blurb:
          "A reproducible testbed for a hard recommender-systems question: should an AI optimize for learning a person's taste, or for helping them discover valuable new territory?",
        proof: "640 trajectories · 25,600 recommendations",
        tech: ["Python", "Bayesian modeling", "NetworkX", "Plotly"],
        repo: "https://github.com/rsheth8/Human-AI-Discovery",
        demo: "",
      },
      {
        name: "MyDrive",
        label: "ML route planning",
        blurb:
          "A Chicagoland route planner that scores road segments with an XGBoost accident-risk model, then compares routes by time, tolls, calm, and safety.",
        proof: "Scores and compares up to 8 routes",
        tech: ["Python", "XGBoost", "FastAPI", "Streamlit", "OpenStreetMap"],
        repo: "https://github.com/rsheth8/MyDrive",
        demo: "",
      },
      {
        name: "Storelytics",
        label: "Computer vision",
        blurb:
          "Turns a doorway camera into visit counts, dwell time, and aggregate audience signals using face re-identification—while retaining encodings instead of photos.",
        proof: "Encodings retained · source photos discarded",
        tech: ["Python", "OpenCV", "DeepFace", "Redis", "Firebase"],
        repo: "https://github.com/rsheth8/Storelytics",
        demo: "",
      },
      {
        name: "Textbook RAG",
        label: "Grounded retrieval",
        blurb:
          "A Java learning assistant that ingests textbook PDFs, retrieves the most relevant passage, and keeps answers grounded in the uploaded source.",
        proof: "Local Ollama or Open WebUI backend",
        tech: ["Java 17", "Spring Boot", "PostgreSQL", "PDFBox", "Ollama"],
        repo: "https://github.com/rsheth8/Textbook_RAG_Assistant",
        demo: "",
      },
    ],
  },
  {
    id: "infra-projects",
    accent: "mid",
    role: "Data Engineering",
    track: "04",
    copy: "Audio, documents, cost, and behavior turned into reliable data products.",
    projects: [
      {
        name: "CatchMeUp",
        label: "Local AI pipeline",
        blurb:
          "A local-first macOS and iPhone workspace that turns missed meetings or lectures into recaps, decisions, action items, study guides, and source-grounded answers.",
        proof: "Recording → transcript → Word + Markdown",
        tech: ["Python", "SwiftUI", "WhisperKit", "ffmpeg", "Claude"],
        repo: "https://github.com/rsheth8/CatchMeUp",
        demo: "",
      },
      {
        name: "InfraTrack",
        label: "Cloud FinOps",
        blurb:
          "Cloud-spend dashboard for engineering teams — per-service AWS tracking, month-to-date budget burn, and threshold email alerts.",
        proof: "Team budgets · daily spend · alerts",
        tech: ["FastAPI", "SQLAlchemy", "Postgres", "React", "Vite"],
        repo: "https://github.com/rsheth8/InfraTrack",
        demo: "",
      },
      {
        name: "SongSift",
        label: "Audio intelligence",
        blurb:
          "End-to-end music workbench — extracts audio features with librosa, recommends and clusters tracks, builds a similarity graph, and beat-matches mashups.",
        proof: "Local-first audio processing",
        tech: ["Python", "librosa", "Flask", "React", "TypeScript"],
        repo: "https://github.com/rsheth8/SongSift",
        demo: "",
      },
    ],
  },
  {
    id: "consumer-projects",
    accent: "high",
    role: "Software Engineering",
    track: "05",
    copy: "End-to-end web, desktop, and mobile products — with live demos and graceful fallback paths.",
    projects: [
      {
        name: "Bar4Bar",
        label: "Real-time media",
        blurb:
          "Projector karaoke that identifies what's playing, resolves or generates timed lyrics, and keeps every word synchronized across a main display and second screen.",
        proof: "Web · Electron · tvOS",
        tech: ["JavaScript", "Electron", "Whisper", "Web Audio", "Swift"],
        repo: "https://github.com/rsheth8/smart_lyric",
        demo: "https://smartlyric.vercel.app",
      },
      {
        name: "Record Finder",
        label: "Recommendation product",
        blurb:
          "Vinyl discovery from a taste quiz or Spotify history, enriched with Discogs catalog data, fair-value signals, wishlists, and price-drop alerts.",
        proof: "7-step taste quiz · live catalog data",
        tech: ["Next.js", "TypeScript", "Drizzle", "Discogs", "Spotify"],
        repo: "https://github.com/rsheth8/record_finder",
        demo: "https://record-finder-nine.vercel.app",
      },
      {
        name: "Hindsight",
        label: "Learning game",
        blurb:
          "A daily investing puzzle that grades judgment, calibration, and written reasoning—not just whether a noisy market call happened to be right.",
        proof: "Daily game · 3-part skill rating",
        tech: ["Next.js", "TypeScript", "React Native", "Claude", "Vitest"],
        repo: "https://github.com/rsheth8/Hindsight",
        demo: "https://hindsight-one.vercel.app",
      },
      {
        name: "Distill",
        label: "Browser extension",
        blurb:
          "A Chrome extension that helps you read long articles — progressive AI summaries, comprehension check-ins, and focus tools, with bring-your-own-key AI.",
        proof: "Bring-your-own-key AI",
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
    skills: ["Python", "TypeScript", "Swift", "Go", "Java", "SQL"],
  },
  {
    label: "AI / ML",
    color: "#b14dff", // accent — violet
    band: "mid",
    skills: ["PyTorch", "scikit-learn", "XGBoost", "OpenCV", "Bayesian modeling", "RAG"],
  },
  {
    label: "Backend & Data",
    color: "#00d6ff", // mid — cyan
    band: "lowMid",
    skills: ["FastAPI", "Spring Boot", "Node.js", "PostgreSQL", "Redis", "Drizzle ORM"],
  },
  {
    label: "Web & Mobile",
    color: "#ffe66c", // high — yellow
    band: "highMid",
    skills: ["React", "Next.js", "React Native", "SwiftUI", "Electron", "Expo"],
  },
  {
    label: "Tools & Cloud",
    color: "#8aa8c8", // ice — cold blue
    band: "high",
    skills: ["Docker", "Git", "AWS", "Vercel", "Playwright", "Vitest"],
  },
];
