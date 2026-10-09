/**
 * Mods cell of API-rendered scoreboard rows (WS-31): mod buttons cloned from
 * osu-web's own, speed-change labels and custom-rate detection.
 */

import {
  formatSpeedChange,
  isNonDefaultSpeed,
  modFullName,
  speedChangeFromMod,
} from "../../osu/mods.js";
import { el } from "../legacy.js";
import { MOD_GRID_CLASS } from "./context.js";

/**
 * Row #1 is often NM — no `.beatmap-scoreboard-mod` inside its mods cell. Use any
 * mod chip on the table or the scoreboard filter bar as clone source.
 * @param {ParentNode|null|undefined} scoreboardRoot
 * @returns {HTMLElement|null}
 */
export function resolveBeatmapScoreboardModTemplateEl(scoreboardRoot) {
  const inRoot = (sel) => scoreboardRoot?.querySelector?.(sel) ?? null;
  // Expert+ mod grid hides osu’s original strip with data-oep-mod-hidden; those nodes
  // are first in DOM order and can be stale for masks — prefer grid pile clones.
  const pileModSel = `.${MOD_GRID_CLASS}__pile .beatmap-scoreboard-mod`;
  const stripVisibleSel =
    ".beatmapset-scoreboard__mods .beatmap-scoreboard-mod:not([data-oep-mod-hidden])";
  const chain = [
    () => inRoot(".beatmap-scoreboard-table__mods .beatmap-scoreboard-mod"),
    () => inRoot(".beatmap-scoreboard-table__body .beatmap-scoreboard-mod"),
    () => inRoot(pileModSel),
    () => document.querySelector(pileModSel),
    () => inRoot(stripVisibleSel),
    () => document.querySelector(stripVisibleSel),
    () =>
      document.querySelector(
        ".beatmap-scoreboard-mod:not([data-oep-mod-hidden])",
      ),
    () => document.querySelector(".beatmap-scoreboard-mod"),
  ];
  for (const fn of chain) {
    const el = fn();
    if (el instanceof HTMLElement) return el;
  }
  return null;
}

/**
 * @param {HTMLElement} btn
 * @param {string} acronym
 * @param {{ speedChange?: number }|undefined} [opts]
 */
export function patchBeatmapScoreboardModButton(btn, acronym, opts) {
  const mi = OsuExpertPlus.modIconsAsAcronyms;
  mi?.stripOepModAcronymFromClonedMod?.(btn);
  btn.removeAttribute("data-oep-mod-hidden");
  const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
  const full = modFullName(acronym);
  const icon = btn.querySelector(".mod__icon");
  if (icon instanceof HTMLElement) {
    icon.className = `mod__icon mod__icon--${safe}`;
    icon.setAttribute("data-acronym", acronym);
  }
  const modRoot =
    btn.querySelector?.(".mod") ??
    (icon instanceof HTMLElement ? icon.closest?.(".mod") : null) ??
    btn.closest?.(".mod") ??
    null;
  const typeClass =
    mi?.modTypeClassForAcronym?.(acronym) || "mod--type-Automation";
  // osu-web controls mod background color via CSS vars on the ancestor
  // element that has `mod--type-*` (the element that `icon.closest('.mod')`
  // finds, not necessarily `btn` itself).
  /** @type {HTMLElement[]} */
  const targets = [];
  const push = (el) => {
    if (el instanceof HTMLElement && !targets.includes(el)) targets.push(el);
  };
  push(btn);
  push(btn.closest?.(".mod") ?? null);
  push(icon instanceof HTMLElement ? icon.closest(".mod") : null);
  push(btn.querySelector?.(".mod") ?? null);

  for (const target of targets) {
    // Remove any existing mod tone classes.
    for (const cls of [...target.classList]) {
      if (/^mod--type-/i.test(cls)) target.classList.remove(cls);
    }
    target.classList.add(typeClass);
  }

  // Mirror `user-profile` patch: strip hover/extra UI remnants; re-add extender for custom rate.
  btn.querySelector(".mod__extender")?.remove();
  btn.querySelector(".mod__customised-indicator")?.remove();
  const sc = opts?.speedChange;
  const showRate = Number.isFinite(sc) && isNonDefaultSpeed(acronym, sc);
  const rateStr = showRate ? formatSpeedChange(sc, { style: "trim" }) : "";
  const fullLabel = rateStr ? `${full} (${rateStr})` : full;
  const modInner =
    (btn.querySelector(".mod") instanceof HTMLElement
      ? btn.querySelector(".mod")
      : modRoot) ?? btn;
  if (rateStr && modInner instanceof HTMLElement) {
    const ext = document.createElement("div");
    ext.className = "mod__extender";
    const sp = document.createElement("span");
    sp.textContent = rateStr;
    ext.appendChild(sp);
    const iconEl = modInner.querySelector(".mod__icon");
    if (iconEl instanceof HTMLElement) {
      iconEl.insertAdjacentElement("afterend", ext);
    } else {
      modInner.appendChild(ext);
    }
  }
  btn.title = fullLabel;
  btn.setAttribute("aria-label", fullLabel);
  btn.setAttribute("data-original-title", fullLabel);
  btn.setAttribute("data-qtip", fullLabel);
  btn.setAttribute("data-tooltip", fullLabel);
  if (modRoot instanceof HTMLElement) {
    modRoot.title = fullLabel;
    // osu-web's tooltip is wired to the inner `.mod` element via `data-orig-title`.
    // (In the native DOM: `.mod` has `data-orig-title="Easy"` even when the button
    // wrapper has the correct `data-qtip`.)
    modRoot.setAttribute("data-orig-title", fullLabel);
  }
  if (icon instanceof HTMLElement) {
    icon.title = fullLabel;
    icon.setAttribute("aria-label", fullLabel);
    icon.setAttribute("data-original-title", fullLabel);
    icon.setAttribute("data-qtip", fullLabel);
    icon.setAttribute("data-tooltip", fullLabel);
  }

  // Prevent selection-actions (filtering) but allow hover/tooltips.
  btn.addEventListener(
    "click",
    (e) => {
      e.preventDefault();
      e.stopPropagation();
    },
    true,
  );

  // Make it render as "enabled" so osu-web doesn't dim it when not hovered.
  btn.classList.add("beatmap-scoreboard-mod--enabled");
}

/**
 * When no table row has mods, the template is a filter strip or mod grid
 * button, which carries the filter state: `disabled`, `aria-pressed`, our
 * wildcard and hidden markers (B18). Clear that so table mods look like
 * osu-web's own (enabled, no filter markers).
 * @param {HTMLElement} btn  a fresh clone of the template
 */
function stripModButtonState(btn) {
  for (const node of [btn, ...btn.querySelectorAll("*")]) {
    for (const { name } of [...node.attributes]) {
      if (
        name.startsWith("data-oep-") ||
        name === "disabled" ||
        name === "aria-pressed" ||
        name === "aria-disabled"
      ) {
        node.removeAttribute(name);
      }
    }
    for (const cls of [...node.classList]) {
      if (
        cls.startsWith("oep-") ||
        cls === "beatmap-scoreboard-mod--disabled"
      ) {
        node.classList.remove(cls);
      }
    }
    if (node.classList.contains("beatmap-scoreboard-mod")) {
      node.classList.add("beatmap-scoreboard-mod--enabled");
    }
  }
}

/**
 * @param {HTMLTableCellElement} td
 * @param {object} score
 * @param {HTMLElement|null} modTemplateBtn  from {@link resolveBeatmapScoreboardModTemplateEl}
 */
export function applyScoreboardModsCell(td, score, modTemplateBtn) {
  const wrap = td.querySelector(".beatmap-scoreboard-table__mods");
  if (!wrap) return;
  wrap.replaceChildren();
  const list = score.mods || [];
  const mi = OsuExpertPlus.modIconsAsAcronyms;
  if (modTemplateBtn instanceof HTMLElement) {
    for (const m of list) {
      const ac = typeof m === "string" ? m : m?.acronym;
      if (!ac) continue;
      const btn = /** @type {HTMLElement} */ (modTemplateBtn.cloneNode(true));
      stripModButtonState(btn);
      const spd = speedChangeFromMod(m);
      patchBeatmapScoreboardModButton(
        btn,
        ac,
        Number.isFinite(spd) && isNonDefaultSpeed(ac, spd)
          ? { speedChange: spd }
          : undefined,
      );
      wrap.appendChild(btn);
    }
  } else if (list.length) {
    for (const m of list) {
      const ac = typeof m === "string" ? m : m?.acronym;
      if (!ac) continue;
      const safe = String(ac).replace(/[^A-Za-z0-9]/g, "") || "X";
      const typeClass =
        mi?.modTypeClassForAcronym?.(ac) || "mod--type-Automation";
      let full = modFullName(ac);
      const spd = speedChangeFromMod(m);
      const showRate = Number.isFinite(spd) && isNonDefaultSpeed(ac, spd);
      const rateStr = showRate ? formatSpeedChange(spd, { style: "trim" }) : "";
      if (rateStr) full = `${full} (${rateStr})`;
      const iconEl = el("div", {
        class: `mod__icon mod__icon--${safe}`,
        "data-acronym": ac,
        title: full,
        "aria-label": full,
        "data-original-title": full,
        "data-qtip": full,
        "data-tooltip": full,
      });
      const modInnerKids = [iconEl];
      if (rateStr) {
        modInnerKids.push(
          el("div", { class: "mod__extender" }, el("span", {}, rateStr)),
        );
      }
      const modEl = /** @type {HTMLElement} */ (
        el(
          "div",
          {
            class: `beatmap-scoreboard-mod mod ${typeClass} beatmap-scoreboard-mod--enabled`,
            title: full,
            "aria-label": full,
            "data-original-title": full,
            "data-qtip": full,
            "data-tooltip": full,
          },
          ...modInnerKids,
        )
      );
      modEl.addEventListener(
        "click",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true,
      );
      wrap.appendChild(modEl);
    }
  }
}
