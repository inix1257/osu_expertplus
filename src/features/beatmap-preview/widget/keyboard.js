/**
 * Keyboard control of the preview panel (WS-51).
 */

/**
 * Space/Enter: play/pause. ArrowLeft/ArrowRight: ±1s seek.
 * Volume sliders and the offset field keep native arrow behaviour; buttons
 * and inputs keep Space and Enter.
 * @param {object} state  the widget state (see widget/index.js)
 * @param {import("./dom.js").PreviewDom} dom
 * @param {import("./transport.js").PreviewTransport} transport
 * @returns {(ev: KeyboardEvent) => void}  the panel's keydown listener
 */
export function createPreviewKeydown(state, dom, transport) {
  const {
    panel,
    seekRange,
    musicVolumeRange,
    hitsoundVolumeRange,
    offsetInput,
  } = dom;
  return function onPreviewPanelKeydown(ev) {
    if (
      !state.expanded ||
      panel.hidden ||
      !state.lastLoadedKey ||
      seekRange.disabled ||
      state.busy
    ) {
      return;
    }
    const t = ev.target;
    if (!(t instanceof Node) || !panel.contains(t)) return;
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;

    const key = ev.key;
    const isArrow = key === "ArrowLeft" || key === "ArrowRight";
    const isPlayKey = key === " " || key === "Enter" || key === "Spacebar";

    if (isArrow) {
      if (
        t === musicVolumeRange ||
        t === hitsoundVolumeRange ||
        t === offsetInput
      ) {
        return;
      }
      ev.preventDefault();
      transport.seekByDeltaMs(key === "ArrowLeft" ? -1000 : 1000);
      return;
    }

    if (isPlayKey) {
      if (t instanceof HTMLButtonElement) return;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) {
        return;
      }
      ev.preventDefault();
      transport.togglePlaybackFromCanvas();
    }
  };
}
