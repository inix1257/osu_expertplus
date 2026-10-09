/**
 * Clicks osu-web's hidden strip buttons one per animation frame, so React
 * can settle between clicks (exclusive mods, URL sync) (WS-32).
 *
 * Plans run one after another from a single queue, so two plans never click
 * the same strip at once (B80).
 */

/**
 * @typedef {{
 *   key?: string,
 *   next: () => HTMLElement|null,
 *   done: (completed: boolean) => void,
 *   maxSteps?: number,
 * }} ClickPlan
 *   `next` returns the button to click this frame, or null when finished; it
 *   is called again every frame, so a plan can follow a goal that changes
 *   while it runs. `done` runs once: `completed` is false when `maxSteps`
 *   frames ran out. A queued plan with the same `key` is replaced.
 */

const DEFAULT_MAX_STEPS = 64;

/** @type {ClickPlan[]} */
const queue = [];
/** @type {ClickPlan|null} */
let running = null;

/**
 * @param {ClickPlan} plan
 */
export function queueClicks(plan) {
  const i = plan.key ? queue.findIndex((p) => p.key === plan.key) : -1;
  if (i >= 0) queue[i] = plan;
  else queue.push(plan);
  if (!running) startNext();
}

/**
 * @param {string} key
 * @returns {boolean}  whether a plan with `key` is running or queued
 */
export function hasQueuedClicks(key) {
  return running?.key === key || queue.some((p) => p.key === key);
}

/** Drop every queued plan and stop the running one (its `done` is not called). */
export function cancelClicks() {
  queue.length = 0;
  running = null;
}

function startNext() {
  const plan = queue.shift() ?? null;
  running = plan;
  if (!plan) return;
  const maxSteps = plan.maxSteps ?? DEFAULT_MAX_STEPS;
  let steps = 0;
  const finish = (completed) => {
    running = null;
    try {
      plan.done(completed);
    } finally {
      if (!running) startNext();
    }
  };
  const tick = () => {
    if (running !== plan) return;
    if (++steps > maxSteps) {
      finish(false);
      return;
    }
    const btn = plan.next();
    if (!btn) {
      finish(true);
      return;
    }
    btn.click();
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}
