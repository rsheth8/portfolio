import { Section } from "@/components/sections/Section";
import { ScrollProgress } from "@/components/ScrollProgress";
import { AudioSourcePicker } from "@/components/audio/AudioSourcePicker";
import { GlitchTypeBackdrop } from "@/components/audio/GlitchTypeBackdrop";
import { ProjectGrid } from "@/components/ProjectGrid";
import { SkillsEqualizer } from "@/components/SkillsEqualizer";
import { SkillsBackdrop } from "@/components/SkillsBackdrop";
import { RoleNav } from "@/components/RoleNav";
import { AskAI } from "@/components/ai/AskAI";
import { SoundNudge } from "@/components/audio/SoundNudge";
import { DropFlash } from "@/components/audio/DropFlash";
import { FFTHud } from "@/components/audio/FFTHud";
import { BeatHaptics } from "@/components/audio/BeatHaptics";
import { GuidedTour } from "@/components/GuidedTour";
import { KeyboardControls } from "@/components/KeyboardControls";
import { ThemeController } from "@/components/theme/ThemeController";
import { LazyScene } from "@/components/scenes/LazyScene";
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
    <main id="main-content" className="relative">
      <a
        href="#hero-actions"
        className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-full bg-cream px-4 py-2 font-mono text-sm text-ink transition-transform focus:translate-y-0"
      >
        Skip to content
      </a>
      <ThemeController />
      <DropFlash />
      <ScrollProgress />
      <RoleNav />
      <GuidedTour />
      <FFTHud />
      <KeyboardControls />
      <BeatHaptics />
      <AudioSourcePicker />
      <SoundNudge />
      <AskAI />

      <Section
        id="hero"
        label="00 — Pulse"
        title="Rahil Sheth"
        copy="I build ambitious software across AI, data, and the web — from safer routes to real-time lyric sync. Pick a role above, or add a soundtrack and explore."
        tone="ink"
        heightVh={220}
        scene={
          <LazyScene poster="from-bass/25" eager>
            <HeroOrbSceneClient />
          </LazyScene>
        }
      >
        <div
          id="hero-actions"
          tabIndex={-1}
          className="flex flex-wrap gap-3 font-mono text-xs uppercase tracking-wider focus:outline-none sm:text-sm"
        >
          <a
            href="#ml-projects"
            className="rounded-full border border-cream/40 bg-cream px-5 py-3 text-ink transition hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Explore selected work ↓
          </a>
          <a
            href={`mailto:${profile.email}`}
            className="rounded-full border border-bone/25 bg-ink/55 px-5 py-3 text-cream backdrop-blur-md transition hover:border-mid/70 hover:text-mid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Start a conversation ↗
          </a>
        </div>
      </Section>

      <Section
        id="about"
        label="01 — Track 01"
        title="Complex underneath. Clear on top."
        copy="I turn complicated systems into products people can actually use: evaluated ML, reliable pipelines, polished interfaces, and fallback paths that keep the experience working."
        tone="ink"
        heightVh={200}
        scene={
          <LazyScene poster="from-mid/20">
            <WaveformSheetSceneClient />
          </LazyScene>
        }
      />

      <Section
        id="skills"
        label="02 — Spectrum"
        title="Frequency."
        copy="The stack, on the EQ — each channel pulses to whatever you're playing."
        tone="ink"
        heightVh={200}
        scene={
          <LazyScene poster="from-accent/15">
            <SkillsBackdrop />
          </LazyScene>
        }
      >
        <SkillsEqualizer />
      </Section>

      <Section
        id="ml-projects"
        label={`${group["ml-projects"].track} · ${group["ml-projects"].role}`}
        title="Models, measured."
        copy={group["ml-projects"].copy}
        tone="ink"
        heightVh={220}
        contentFlow
        scene={
          <LazyScene poster="from-bass/20">
            <ParticleBurstSceneClient />
          </LazyScene>
        }
      >
        <ProjectGrid id="ml-projects" />
      </Section>

      <Section
        id="infra-projects"
        label={`${group["infra-projects"].track} · ${group["infra-projects"].role}`}
        title="Pipelines with a purpose."
        copy={group["infra-projects"].copy}
        tone="ink"
        heightVh={220}
        contentFlow
        scene={
          <LazyScene poster="from-ice/15">
            <WarpGridSceneClient />
          </LazyScene>
        }
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
        contentFlow
        scene={<GlitchTypeBackdrop tokens={["BAR4BAR", "HINDSIGHT", "DISTILL"]} />}
      >
        <ProjectGrid id="consumer-projects" />
      </Section>

      <Section
        id="contact"
        label="06 — Outro"
        title="Let’s make something useful."
        copy="Have a role, a project, or a hard problem that fits? Email is the fastest way to reach me."
        tone="ink"
        heightVh={180}
        scene={
          <LazyScene poster="from-high/10">
            <OutroFadeSceneClient />
          </LazyScene>
        }
      >
        <div className="grid gap-3 font-mono text-sm sm:grid-cols-2 md:grid-cols-4">
          {contactLinks.map((link) => (
            <a
              key={link.label}
              className="group flex min-h-20 items-center justify-between rounded-xl border border-bone/20 bg-ink/55 p-5 backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-mid/50 hover:bg-bone/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
            >
              <span>{link.label}</span>
              <span className="text-mute transition group-hover:text-mid">↗</span>
            </a>
          ))}
        </div>
      </Section>
    </main>
  );
}
