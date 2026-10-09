/**
 * Mods cell of API-rendered scoreboard rows (WS-31): mod buttons cloned from
 * osu-web's own, speed-change labels and custom-rate detection.
 */

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
 * @param {string} acronym
 * @returns {string}
 */
export function modFullName(acronym) {
  const a = String(acronym || "")
    .trim()
    .toUpperCase();
  if (!a) return "";

  // Lazer mod names (used for hover tooltips).
  const map = {
    EZ: "Easy",
    NF: "No Fail",
    HT: "Half Time",
    DC: "Daycore",
    NR: "No Release",

    HR: "Hard Rock",
    SD: "Sudden Death",
    PF: "Perfect",
    DT: "Double Time",
    NC: "Nightcore",
    FI: "Fade In",
    HD: "Hidden",
    CO: "Cover",
    FL: "Flashlight",
    BL: "Blinds",
    ST: "Strict Tracking",
    AC: "Accuracy Challenge",

    AT: "Autoplay",
    CN: "Cinema",
    RX: "Relax",
    AP: "Autopilot",
    SO: "Spun Out",

    TP: "Target Practice",
    DA: "Difficulty Adjust",
    CL: "Classic",
    RD: "Random",
    MR: "Mirror",
    AL: "Alternate",
    SW: "Swap",
    SG: "Single Tap",
    IN: "Invert",
    CS: "Constant Speed",
    HO: "Hold Off",

    TR: "Transform",
    WG: "Wiggle",
    SI: "Spin In",
    GR: "Grow",
    DF: "Deflate",
    WU: "Wind Up",
    WD: "Wind Down",
    TC: "Traceable",
    BR: "Barrel Roll",
    AD: "Approach Different",
    FF: "Floating Fruits",
    MU: "Muted",
    NS: "No Scope",
    MG: "Magnetised",
    RP: "Repel",
    AS: "Adaptive Speed",
    FR: "Freeze Frame",
    BU: "Bubbles",
    SY: "Synesthesia",
    DP: "Depth",
    BM: "Bloom",

    SV2: "Score V2",
    TD: "Touch Device",
  };

  // Key mods are 1K..10K.
  if (/^[1-9]K$/.test(a) || /^10K$/.test(a)) {
    const n = Number(a.slice(0, -1));
    return `${n} Key Mod`;
  }

  return map[a] ?? a;
}

/**
 * @param {number} speedChange
 * @returns {string}
 */
export function formatScoreboardModSpeedRate(speedChange) {
  const x = Number(speedChange);
  if (!Number.isFinite(x) || x <= 0) return "";
  const rounded = Math.round(x * 100) / 100;
  let t = String(rounded);
  if (t.includes(".")) t = t.replace(/\.?0+$/, "");
  return `${t}×`;
}

export const SCOREBOARD_MOD_DEFAULT_SPEED_UP = 1.5;

export const SCOREBOARD_MOD_DEFAULT_SPEED_DOWN = 0.75;

export const SCOREBOARD_MOD_SPEED_EPS = 0.005;

/**
 * Show rate only when API sends `speed_change` and it differs from osu defaults
 * (1.5× DT/NC, 0.75× HT/DC).
 * @param {string} acronym
 * @param {number} speed
 * @returns {boolean}
 */
export function shouldShowScoreboardModSpeedIndicator(acronym, speed) {
  if (!Number.isFinite(speed) || speed <= 0) return false;
  const ac = String(acronym || "")
    .trim()
    .toUpperCase();
  if (ac === "HT" || ac === "DC") {
    return (
      Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_DOWN) >
      SCOREBOARD_MOD_SPEED_EPS
    );
  }
  if (ac === "DT" || ac === "NC") {
    return (
      Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
      SCOREBOARD_MOD_SPEED_EPS
    );
  }
  return (
    Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) > SCOREBOARD_MOD_SPEED_EPS
  );
}

/**
 * @param {unknown} mod  API mod object with optional `settings.speed_change`
 * @returns {number}  finite speed, or NaN if absent
 */
export function speedChangeFromScoreMod(mod) {
  if (mod == null || typeof mod !== "object") return NaN;
  const sc = /** @type {{ settings?: { speed_change?: unknown } }} */ (mod)
    .settings?.speed_change;
  const x = Number(sc);
  return Number.isFinite(x) && x > 0 ? x : NaN;
}

/**
 * Returns true when the score contains a mod whose speed_change differs from
 * that mod's default rate (1.50× for DT/NC, 0.75× for HT/DC, 1.00× otherwise).
 * @param {object} score
 * @returns {boolean}
 */
export function scoreHasNonstandardRate(score) {
  const mods = /** @type {unknown[]} */ (score?.mods ?? []);
  for (const m of mods) {
    const ac =
      typeof m === "string"
        ? m
        : /** @type {{ acronym?: unknown }} */ (m)?.acronym;
    const spd = speedChangeFromScoreMod(m);
    if (
      Number.isFinite(spd) &&
      shouldShowScoreboardModSpeedIndicator(String(ac ?? ""), spd)
    ) {
      return true;
    }
  }
  return false;
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
  const showRate =
    Number.isFinite(sc) && shouldShowScoreboardModSpeedIndicator(acronym, sc);
  const rateStr = showRate ? formatScoreboardModSpeedRate(sc) : "";
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
      const spd = speedChangeFromScoreMod(m);
      patchBeatmapScoreboardModButton(
        btn,
        ac,
        Number.isFinite(spd) && shouldShowScoreboardModSpeedIndicator(ac, spd)
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
      const spd = speedChangeFromScoreMod(m);
      const showRate =
        Number.isFinite(spd) && shouldShowScoreboardModSpeedIndicator(ac, spd);
      const rateStr = showRate ? formatScoreboardModSpeedRate(spd) : "";
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
