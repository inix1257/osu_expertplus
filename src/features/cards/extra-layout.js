/**
 * Layout fixes the card extras need: the listing's virtual list height and
 * the difficulty popup's highlight height (WS-50).
 */

import { isBeatmapsetsListing } from "../../core/routes.js";

/**
 * osu-web's difficulty popup (`.beatmaps-popup`, rendered via Portal) draws a highlight border
 * using `::before { height: calc(100% + var(--panel-height)) }`. `--panel-height` is a fixed
 * CSS variable set on `.beatmaps-popup` itself, so it doesn't account for our injected rows.
 * Sync the popup's `--panel-height` to the actual rendered height of the hovered panel.
 */
export function syncPopupHighlightHeight() {
  const activePanel = document.querySelector(
    ".beatmapset-panel--beatmaps-popup-visible",
  );
  const popup = document.querySelector(".beatmaps-popup");
  if (!activePanel || !popup) return;
  const actual = /** @type {HTMLElement} */ (activePanel).offsetHeight;
  if (actual > 0) {
    /** @type {HTMLElement} */ (popup).style.setProperty(
      "--panel-height",
      actual + "px",
    );
  }
}

/**
 * Listing uses a virtual list: the first child of `.beatmapsets__content` gets an inline
 * `height` from osu-web from row count × assumed row height. Extra card rows increase real
 * content height without updating that value, so the b5 page background shows past the block.
 * @param {Element} outer
 * @param {Element} items
 */
function syncBeatmapsetsListingOuterHeight(outer, items) {
  if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement))
    return;
  const st = outer.getAttribute("style") || "";
  if (!/height\s*:\s*[\d.]+\s*px/i.test(st)) return;
  const cs = getComputedStyle(outer);
  const padY =
    (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const minOuter = Math.ceil(items.scrollHeight + padY);
  if (minOuter > outer.clientHeight + 0.5) {
    outer.style.height = `${minOuter}px`;
  }
}

/**
 * Keeps the listing's virtual list as tall as its (taller) cards while
 * `isOn()` and on the listing page.
 * @param {() => boolean} isOn
 * @returns {{ schedule: () => void, detach: () => void }}
 */
export function createListingHeightSync(isOn) {
  /** @type {ResizeObserver|null} */
  let ro = null;
  /** @type {Element|null} */
  let observed = null;

  function detach() {
    if (ro) {
      ro.disconnect();
      ro = null;
      observed = null;
    }
  }

  function attach() {
    if (!isOn() || !isBeatmapsetsListing(location.pathname)) {
      detach();
      return;
    }
    const content = document.querySelector(".beatmapsets__content");
    const outer = content?.firstElementChild;
    const items = outer?.querySelector?.(".beatmapsets__items");
    if (!(outer instanceof HTMLElement) || !(items instanceof HTMLElement)) {
      detach();
      return;
    }
    if (observed === items && ro) {
      syncBeatmapsetsListingOuterHeight(outer, items);
      return;
    }
    detach();
    observed = items;
    ro = new ResizeObserver(() => {
      syncBeatmapsetsListingOuterHeight(outer, items);
    });
    ro.observe(items);
    syncBeatmapsetsListingOuterHeight(outer, items);
  }

  return {
    schedule() {
      if (!isOn() || !isBeatmapsetsListing(location.pathname)) {
        detach();
        return;
      }
      requestAnimationFrame(() => {
        requestAnimationFrame(attach);
      });
    },
    detach,
  };
}
