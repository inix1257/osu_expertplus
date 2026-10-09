/**
 * Expand/collapse for osu-web BBCode spoilers in copied description HTML (WS-33).
 */

/**
 * Bind spoiler toggles for BBCode rendered HTML. Call once `root` is in the
 * document and visible: the initial open state is read from layout (B59).
 *
 * osu!web wires spoiler interactivity for descriptions already present in the DOM.
 * Our modal injects BBCode HTML dynamically, so those click handlers may not be attached.
 * This provides a lightweight fallback that toggles commonly-used spoiler structures.
 * @param {HTMLElement} root
 */
export function bindBbcodeSpoilers(root) {
  if (!root) return;

  // Target spoiler "content" nodes. We intentionally keep this broad because
  // class names can change across osu-web versions.
  const contentSel = [
    "[data-spoiler-content]",
    '[class*="spoiler" i][class*="content" i]',
    '[class*="spoiler" i][class*="body" i]',
    ".spoiler-content",
    ".spoiler__content",
    ".bbcode-spoiler__content",
    ".bbcode__spoiler-content",
  ].join(",");

  const contentEls = Array.from(root.querySelectorAll(contentSel));
  if (contentEls.length === 0) return;

  // Build a container->content map. We prefer a spoiler-ish ancestor above
  // the content node itself so trigger links/buttons can be discovered reliably.
  /** @type {Map<HTMLElement, HTMLElement[]>} */
  const containerToContents = new Map();
  for (const contentEl of contentEls) {
    let container = contentEl.closest('[class*="spoiler" i]');
    if (container === contentEl) {
      container =
        contentEl.parentElement?.closest('[class*="spoiler" i]') ??
        contentEl.parentElement;
    }
    if (!container) continue;
    const arr = containerToContents.get(container) ?? [];
    arr.push(contentEl);
    containerToContents.set(container, arr);
  }

  const triggerSel = [
    "summary",
    "button",
    '[role="button"]',
    "[data-spoiler-toggle]",
    '[class*="spoiler" i][class*="title" i]',
    '[class*="spoiler" i][class*="trigger" i]',
    '[class*="spoiler" i][class*="toggle" i]',
    '[class*="spoiler" i][class*="link" i]',
    ".spoiler-title",
    ".spoiler__title",
    ".spoiler-toggle",
    ".spoiler__toggle",
    ".bbcode-spoiler__title",
    ".bbcode__spoiler-title",
    ".bbcode-spoilerbox__link",
  ].join(",");

  const isOpenInitial = (el) => {
    // Some spoiler implementations collapse via `display: none`,
    // others use `max-height: 0` / `height: 0` (still `display: block`).
    // We treat the spoiler as "open" only if it looks render-visible.
    try {
      const cs = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const renderVisible =
        rect.width > 0 && rect.height > 0 && cs.visibility !== "hidden";
      return cs.display !== "none" && renderVisible && cs.opacity !== "0";
    } catch {
      return !el.hidden;
    }
  };

  /**
   * The innermost spoiler container holding `node`: a nested spoiler's
   * trigger belongs to it, not to the spoilers around it (B59).
   * @param {Element} node
   */
  const ownerOf = (node) => {
    for (let n = node.parentElement; n && n !== root; n = n.parentElement) {
      if (containerToContents.has(/** @type {HTMLElement} */ (n))) return n;
    }
    return containerToContents.has(root) ? root : null;
  };

  for (const [container, contents] of containerToContents.entries()) {
    if (!container || container.dataset.oepSpoilersBound === "1") continue;
    container.dataset.oepSpoilersBound = "1";

    for (const contentEl of contents) {
      if (contentEl.dataset.oepSpoilersPrevDisplay != null) continue;
      const inlineDisplay = contentEl.style.display;
      if (inlineDisplay) {
        contentEl.dataset.oepSpoilersPrevDisplay = inlineDisplay;
        continue;
      }
      try {
        const cs = window.getComputedStyle(contentEl);
        if (cs.display && cs.display !== "none")
          contentEl.dataset.oepSpoilersPrevDisplay = cs.display;
      } catch {
        // ignore
      }
    }

    const initiallyOpen = contents.some((c) => isOpenInitial(c));
    container.dataset.oepSpoilersOpen = initiallyOpen ? "1" : "0";

    const triggerEls = Array.from(container.querySelectorAll(triggerSel))
      // Avoid treating the content nodes themselves as triggers, and leave
      // nested spoilers' triggers to them.
      .filter((n) => !contents.includes(n) && ownerOf(n) === container);

    const handler = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const nextOpen = container.dataset.oepSpoilersOpen !== "1";
      container.dataset.oepSpoilersOpen = nextOpen ? "1" : "0";

      for (const contentEl of contents) {
        if (nextOpen) {
          contentEl.hidden = false;
          const prev = contentEl.dataset.oepSpoilersPrevDisplay;
          contentEl.style.display = prev && prev !== "none" ? prev : "block";
        } else {
          contentEl.hidden = true;
          contentEl.style.display = "none";
        }
      }
    };

    // If we can't find a likely trigger element, fall back to clicking the container header.
    // (This keeps behavior closer to expectations than doing nothing.)
    if (triggerEls.length) {
      for (const t of triggerEls) t.addEventListener("click", handler);
    } else {
      container.addEventListener("click", (e) => {
        // Only toggle when clicking within the container but not inside a content node.
        const target = /** @type {HTMLElement} */ (e.target);
        if (!target) return;
        if (contents.some((c) => c.contains(target))) return;
        if (ownerOf(target) !== container && target !== container) return;
        handler(e);
      });
    }

    // Some osu-web spoiler headers are anchors with href="#".
    // Ensure they never trigger page scroll/jump in the modal.
    container.addEventListener("click", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (href === "#") {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
}
