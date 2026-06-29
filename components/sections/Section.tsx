"use client";

import { clsx } from "clsx";
import type { ReactNode } from "react";

export interface SectionProps {
  id: string;
  label: string;
  title: string;
  copy?: string;
  tone?: "ink" | "slate" | "gold" | "bass" | "mid" | "ice";
  /** 3D scene mounted as sticky background. Section auto-grows tall for scroll. */
  scene?: ReactNode;
  /** Total section height in viewport units when scene is present. Default 200. */
  heightVh?: number;
  children?: ReactNode;
}

const toneClass: Record<NonNullable<SectionProps["tone"]>, string> = {
  ink: "bg-ink text-cream",
  slate: "bg-slate text-cream",
  gold: "bg-ink text-gold",
  bass: "bg-ink text-bass",
  mid: "bg-ink text-mid",
  ice: "bg-ink text-ice",
};

export function Section({
  id,
  label,
  title,
  copy,
  tone = "ink",
  scene,
  heightVh = 200,
  children,
}: SectionProps) {
  // Plain section — no 3D, single viewport.
  if (!scene) {
    return (
      <section
        id={id}
        data-section={id}
        className={clsx(
          "scene-section flex items-center justify-center px-8 py-32",
          toneClass[tone],
        )}
      >
        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <Heading label={label} title={title} copy={copy}>
            {children}
          </Heading>
        </div>
      </section>
    );
  }

  // Cinematic section — tall scroll region, sticky 3D stage, text overlays.
  return (
    <section
      id={id}
      data-section={id}
      className={clsx("relative w-full", toneClass[tone])}
      style={{ height: `${heightVh}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 3D stage as background — owns its own Canvas */}
        {scene}

        {/* Text overlay, anchored to bottom of viewport */}
        <div className="relative z-10 flex h-full items-end px-8 pb-24 md:pb-32">
          <div className="mx-auto w-full max-w-5xl">
            <Heading label={label} title={title} copy={copy}>
              {children}
            </Heading>
          </div>
        </div>
      </div>
    </section>
  );
}

function Heading({
  label,
  title,
  copy,
  children,
}: {
  label: string;
  title: string;
  copy?: string;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="mb-6 font-mono text-xs uppercase tracking-[0.4em] opacity-60">
        {label}
      </div>
      <h2 className="font-display text-5xl font-light leading-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] md:text-7xl">
        {title}
      </h2>
      {copy && (
        <p className="mt-8 max-w-2xl text-lg leading-relaxed opacity-80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] md:text-xl">
          {copy}
        </p>
      )}
      {children && <div className="mt-12">{children}</div>}
    </>
  );
}
