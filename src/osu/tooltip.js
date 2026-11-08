/**
 * osu-web's tooltips (qTip) move an element's `title` to `data-orig-title`
 * the first time it is hovered, and never put it back. Code that reads data
 * from a `title` (full pp, ISO score time) must read both, or the value
 * disappears as soon as the user moves the mouse over it.
 */

/**
 * The element's title, whether or not osu-web's tooltip has taken it.
 * React writes a new `title` when the value changes even after a hover, so a
 * present `title` is the current one and wins over `data-orig-title`.
 * @param {Element|null|undefined} el
 * @returns {string|null}
 */
export function tooltipTitle(el) {
  if (!el) return null;
  return el.getAttribute("title") || el.getAttribute("data-orig-title") || null;
}
