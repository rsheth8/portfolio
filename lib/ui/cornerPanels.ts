/** Keeps Ask AI and the audio picker from stacking open on narrow screens. */
export type CornerPanel = "ai" | "audio";

const EVENT = "corner-panel-open";

export function notifyCornerPanelOpen(panel: CornerPanel) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CornerPanel>(EVENT, { detail: panel }));
}

export function onCornerPanelOpen(
  panel: CornerPanel,
  onOtherOpen: () => void,
): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = (e: Event) => {
    const opened = (e as CustomEvent<CornerPanel>).detail;
    if (opened !== panel) onOtherOpen();
  };

  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
