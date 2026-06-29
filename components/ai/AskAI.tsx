"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  notifyCornerPanelOpen,
  onCornerPanelOpen,
} from "@/lib/ui/cornerPanels";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What kind of work does Rahil do?",
  "Tell me about the ML projects.",
  "How many stars does MyDrive have on GitHub?",
];

/**
 * Bottom-left chat widget — an LLM grounded in the portfolio data
 * (see app/api/chat/route.ts). Streams the response token by token.
 *
 * Framer Motion drives the UI motion: the panel springs open/closed via
 * AnimatePresence, each message animates in, and the pill reacts to hover/tap.
 * Sits opposite the audio picker (bottom-right) so the corner controls never
 * overlap.
 */
export function AskAI() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  function syncStickToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  }

  // Pin to the latest message unless the user scrolled up to read earlier turns.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  useEffect(() => {
    if (!open) return;
    stickToBottomRef.current = true;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open]);

  // On mobile, only one corner panel should be open at a time.
  useEffect(() => {
    return onCornerPanelOpen("ai", () => setOpen(false));
  }, []);

  function toggleOpen() {
    setOpen((wasOpen) => {
      const next = !wasOpen;
      if (next) notifyCornerPanelOpen("ai");
      return next;
    });
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const history: Msg[] = [...messages, { role: "user", content: trimmed }];
    // Add the user turn plus an empty assistant turn we'll stream into.
    stickToBottomRef.current = true;
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      if (!res.ok || !res.body) {
        const { error } = await res.json().catch(() => ({ error: null }));
        throw new Error(error ?? "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: acc };
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "assistant",
          content: `Sorry — ${msg}`,
        };
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pointer-events-auto fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-50 sm:bottom-6 sm:left-6">
      {/* Expanded chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{ transformOrigin: "bottom left" }}
            data-lenis-prevent
            className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] flex max-h-[min(28rem,calc(100dvh-7.5rem-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)))] flex-col overflow-hidden rounded-2xl border border-bone/15 bg-graphite/95 font-mono text-xs text-cream shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:mb-3 sm:h-[28rem] sm:w-[22rem] sm:max-h-none sm:max-w-[calc(100vw-3rem)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-bone/10 px-4 py-3">
              <span className="text-[10px] uppercase tracking-[0.25em] text-mute">
                Ask about my work
              </span>
              <button
                onClick={() => setOpen(false)}
                className="min-h-[44px] min-w-[44px] text-mute transition-colors hover:text-cream sm:min-h-0 sm:min-w-0"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>

            {/* Transcript */}
            <div
              ref={scrollRef}
              onScroll={syncStickToBottom}
              data-lenis-prevent
              className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4"
            >
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="leading-relaxed text-bone/70">
                    Hey — ask me anything about Rahil&apos;s projects, stack, or
                    what to look at first.
                  </p>
                  <div className="space-y-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="block w-full rounded-lg border border-bone/15 bg-ink/50 px-3 py-2.5 text-left text-bone/80 transition-colors hover:border-mid/50 hover:text-cream sm:py-2"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className={m.role === "user" ? "text-right" : "text-left"}
                >
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-left leading-relaxed ${
                      m.role === "user"
                        ? "bg-mid/15 text-cream"
                        : "bg-ink/60 text-bone/90"
                    }`}
                  >
                    {m.content ||
                      (busy && i === messages.length - 1 ? "…" : "")}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Composer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex gap-2 border-t border-bone/10 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={(e) => {
                  // Keep the composer visible when the mobile keyboard opens.
                  e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
                placeholder="Type a question…"
                className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-bone/15 bg-ink/60 px-3 py-2 text-base text-cream placeholder:text-mute focus:border-mid/50 focus:outline-none sm:min-h-0 sm:text-[11px]"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="min-h-[44px] rounded-lg border border-mid/40 px-3 py-2 text-[10px] uppercase tracking-wider text-mid transition-colors hover:bg-mid/10 disabled:opacity-40 sm:min-h-0"
              >
                {busy ? "…" : "Send"}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsed pill — always visible */}
      <motion.button
        onClick={toggleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        className="flex min-h-[44px] items-center gap-2 rounded-full border border-bone/15 bg-graphite/85 px-4 py-2.5 font-mono text-xs uppercase tracking-wider text-cream shadow-2xl backdrop-blur-md hover:border-mid/40"
      >
        <motion.span
          className="text-mid"
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          ✦
        </motion.span>
        <span className="text-bone">{open ? "Close" : "Ask AI"}</span>
      </motion.button>
    </div>
  );
}
