import { Section } from "@/components/sections/Section";
import { ScrollProgress } from "@/components/ScrollProgress";
import { AudioSourcePicker } from "@/components/audio/AudioSourcePicker";
import { GlitchTypeBackdrop } from "@/components/audio/GlitchTypeBackdrop";
import { ProjectGrid } from "@/components/ProjectGrid";
import { SkillsEqualizer } from "@/components/SkillsEqualizer";
import { SkillsBackdrop } from "@/components/SkillsBackdrop";
import { RoleNav } from "@/components/RoleNav";
import { AskAI } from "@/components/ai/AskAI";
import { HeroOrbSceneClient } from "@/components/scenes/HeroOrbSceneClient";
import { WaveformSheetSceneClient } from "@/components/scenes/WaveformSheetSceneClient";
import { ParticleBurstSceneClient } from "@/components/scenes/ParticleBurstSceneClient";
import { WarpGridSceneClient } from "@/components/scenes/WarpGridSceneClient";
import { OutroFadeSceneClient } from "@/components/scenes/OutroFadeSceneClient";
import { profile, projectGroups } from "@/data/site";

const group = Object.fromEntries(projectGroups.map((g) => [g.id, g]));

// Contact links, built from the profile. Optional links (LinkedIn, resume) are
// dropped when their URL is empty rather than rendered as dead anchors.
const contactLinks = [
  { label: "Email", href: `mailto:${profile.email}`, external: false },
  { label: "GitHub", href: profile.github, external: true },
  profile.linkedin && {
    label: "LinkedIn",
    href: profile.linkedin,
    external: true,
  },
  profile.resume && { label: "Resume", href: profile.resume, external: true },
].filter(Boolean) as { label: string; href: string; external: boolean }[];

/**
 * Audio-reactive synesthesia portfolio.
 *
 * Seven sections, each with its own visualization style, all reading from
 * the same shared analyser. Pick a source via the corner picker; scroll
 * to journey through the visuals; the music drives the pulse.
 */
export default function Page() {
  return (
    <main className="relative">
      <ScrollProgress />
      <RoleNav />
      <AudioSourcePicker />
      <AskAI />

      <Section
        id="hero"
        label="00 — Pulse"
        title="Rahil Sheth"
        copy="Press the bottom-right corner. Pick something. Watch it react."
        tone="ink"
        heightVh={220}
        scene={<HeroOrbSceneClient />}
      />

      <Section
        id="about"
        label="01 — Track 01"
        title="What I do."
        copy="Full-stack systems, machine learning, the messy bits in between. The waveform is whatever you're playing."
        tone="ink"
        heightVh={200}
        scene={<WaveformSheetSceneClient />}
      />

      <Section
        id="skills"
        label="02 — Spectrum"
        title="Frequency."
        copy="The stack, on the EQ — each channel pulses to whatever you're playing."
        tone="ink"
        heightVh={200}
        scene={<SkillsBackdrop />}
      >
        <SkillsEqualizer />
      </Section>

      <Section
        id="ml-projects"
        label={`${group["ml-projects"].track} · ${group["ml-projects"].role}`}
        title="Models that decide."
        copy={group["ml-projects"].copy}
        tone="ink"
        heightVh={220}
        scene={<ParticleBurstSceneClient />}
      >
        <ProjectGrid id="ml-projects" />
      </Section>

      <Section
        id="infra-projects"
        label={`${group["infra-projects"].track} · ${group["infra-projects"].role}`}
        title="Systems that move data."
        copy={group["infra-projects"].copy}
        tone="ink"
        heightVh={220}
        scene={<WarpGridSceneClient />}
      >
        <ProjectGrid id="infra-projects" />
      </Section>

      <Section
        id="consumer-projects"
        label={`${group["consumer-projects"].track} · ${group["consumer-projects"].role}`}
        title="Products that ship."
        copy={group["consumer-projects"].copy}
        tone="ink"
        heightVh={220}
        scene={<GlitchTypeBackdrop tokens={["PANTRY", "HINDSIGHT", "DISTILL"]} />}
      >
        <ProjectGrid id="consumer-projects" />
      </Section>

      <Section
        id="contact"
        label="06 — Outro"
        title="Find me."
        copy=""
        tone="ink"
        heightVh={180}
        scene={<OutroFadeSceneClient />}
      >
        <div className="grid gap-4 font-mono text-sm sm:grid-cols-2 md:grid-cols-4">
          {contactLinks.map((link) => (
            <a
              key={link.label}
              className="rounded border border-bone/20 p-4 backdrop-blur-sm bg-ink/40 transition-colors hover:bg-bone/5"
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              {link.label}
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
