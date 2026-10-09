/**
 * Clicks osu-web's hidden strip buttons one per animation frame, so React
 * can settle between clicks (exclusive mods, URL sync) (WS-32).
 */

/**
 * @typedef {{
 *   next: () => HTMLElement|null,
 *   done: (completed: boolean) => void,
 *   maxSteps: number,
 * }} ClickPlan
 *   `next` returns the button to click this frame, or null when finished.
 *   `done` runs once: `completed` is false when `maxSteps` frames ran out.
 */

/**
 * @param {ClickPlan} plan
 */
export function runClicks({ next, done, maxSteps }) {
  let steps = 0;
  const tick = () => {
    if (++steps > maxSteps) {
      done(false);
      return;
    }
    const btn = next();
    if (!btn) {
      done(true);
      return;
    }
    btn.click();
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}
