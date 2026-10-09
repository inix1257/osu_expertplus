/**
 * osu-web's qTip tooltips (jQuery on the page window).
 */

/**
 * @param {Element|null|undefined} el
 */
export function destroyOsuWebQtipIfBound(el) {
  try {
    // osu-web's jQuery lives on the page window, not the userscript sandbox.
    const $ = OsuExpertPlus.core.pageWindow.pageWindow().$ || window.$;
    if (!$ || !el || !$.fn?.qtip) return;
    const $el = $(el);
    if ($el.data("qtip")) $el.qtip("destroy");
  } catch (_) {
    void 0;
  }
}

/**
 * qTip’s target can lose hover events when innerHTML is replaced, leaving the popup stuck.
 * @param {HTMLElement} root
 */
export function destroyOsuWebQtipOnElementSubtree(root) {
  if (!(root instanceof HTMLElement)) return;
  destroyOsuWebQtipIfBound(root);
  for (const node of root.querySelectorAll("*")) {
    destroyOsuWebQtipIfBound(node);
  }
}
