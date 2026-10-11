/**
 * Expert+ Recent: mod chips cloned from osu-web's own mod markup (WS-41).
 */

import {
  RATE_DISPLAY,
  formatSpeedChange,
  modAcronym,
  modIconSuffix,
  sortModsForDisplay,
} from "../../../osu/mods.js";
import {
  el,
  modTypeClassForAcronym,
  stripOepModAcronymFromClonedMod,
} from "../../legacy.js";
import { MOD_CUSTOMISED_ATTR } from "../beatmap-attributes.js";
import {
  findRecentPlaysListRoot,
  isInsideOepRecentFailsWrap,
} from "./common.js";
/**
 * A real &lt;Mod&gt; node from osu’s React tree (sprites + layout match the site).
 * Prefers the official Recent plays list on Historical, then Top ranks, then any list.
 * @returns {HTMLElement|null}
 */
export function findOsuModTemplateNode() {
  const fromList = (listEl) => {
    if (!listEl || isInsideOepRecentFailsWrap(listEl)) return null;
    return listEl.querySelector(".play-detail .mods .mod");
  };

  let m = fromList(findRecentPlaysListRoot());
  if (m instanceof HTMLElement) return m;

  const top = document.querySelector('[data-page-id="top_ranks"]');
  if (top && !isInsideOepRecentFailsWrap(top)) {
    for (const pl of top.querySelectorAll(".play-detail-list")) {
      m = fromList(pl);
      if (m instanceof HTMLElement) return m;
    }
  }

  for (const pl of document.querySelectorAll(".play-detail-list")) {
    if (isInsideOepRecentFailsWrap(pl)) continue;
    m = fromList(pl);
    if (m instanceof HTMLElement) return m;
  }
  return null;
}

/**
 * @param {number} maxWaitMs
 * @returns {Promise<HTMLElement|null>}
 */
export function waitForOsuModTemplate(maxWaitMs = 2500) {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const t = findOsuModTemplateNode();
      if (t instanceof HTMLElement) return resolve(t);
      if (Date.now() - start >= maxWaitMs) return resolve(null);
      setTimeout(tick, 120);
    };
    tick();
  });
}

/**
 * @param {HTMLElement} modRoot  cloned .mod from osu
 * @param {string} acronym
 */
function patchClonedModForAcronym(modRoot, acronym) {
  stripOepModAcronymFromClonedMod(modRoot);
  const safe = String(acronym).replace(/[^A-Za-z0-9]/g, "") || "X";
  const icon = modRoot.querySelector(".mod__icon");
  if (icon instanceof HTMLElement) {
    icon.className = `mod__icon mod__icon--${safe}`;
    icon.setAttribute("data-acronym", acronym);
  }
  const typeClass = modTypeClassForAcronym(acronym);
  const parts = modRoot.className.split(/\s+/).filter(Boolean);
  const rest = parts.filter((c) => !c.startsWith("mod--type-"));
  modRoot.className = [...rest, typeClass].join(" ");
  modRoot.querySelector(".mod__extender")?.remove();
  modRoot.querySelector(".mod__customised-indicator")?.remove();
  modRoot.removeAttribute("title");
  modRoot.removeAttribute(MOD_CUSTOMISED_ATTR);
}

/**
 * @param {unknown[]} modsList  API mod objects or strings
 * @param {HTMLElement|null} templateModEl  osu .mod element to clone (from best/recent rows)
 */
export function buildApiScoreModsInner(modsList, templateModEl) {
  const modsInner = el("div", { class: "mods" });
  for (const mod of sortModsForDisplay(modsList)) {
    const ac = modAcronym(mod);
    if (!ac) continue;
    let chip;
    if (templateModEl instanceof HTMLElement) {
      chip = /** @type {HTMLElement} */ (templateModEl.cloneNode(true));
      patchClonedModForAcronym(chip, ac);
    } else {
      const safe = modIconSuffix(ac);
      chip = el(
        "div",
        { class: `mod ${modTypeClassForAcronym(ac)}` },
        el("div", {
          class: `mod__icon mod__icon--${safe}`,
          "data-acronym": ac,
        }),
      );
    }
    applyModCustomisation(chip, mod);
    modsInner.appendChild(chip);
  }
  return modsInner;
}

/**
 * Show a custom rate (DT/NC/HT/DC `speed_change`) the way osu-web does: a
 * `.mod__extender` with "1.30×" plus the customised-cog badge when settings differ.
 * @param {HTMLElement} chip  `.mod` element
 * @param {unknown} mod  API mod object (strings carry no settings)
 */
function applyModCustomisation(chip, mod) {
  const settings = mod && typeof mod === "object" ? mod.settings : null;
  if (!settings || typeof settings !== "object") return;
  if (!Object.keys(settings).length) return;
  // From the score itself: the badge below can only be borrowed when osu-web
  // shows one somewhere on the page (B104).
  chip.setAttribute(MOD_CUSTOMISED_ATTR, "1");

  const rate = Number(settings.speed_change);
  if (Number.isFinite(rate) && rate > 0) {
    const label = formatSpeedChange(rate, RATE_DISPLAY.profile);
    chip.querySelector(".mod__extender")?.remove();
    chip.appendChild(
      el("div", { class: "mod__extender" }, el("span", {}, label)),
    );
    chip.setAttribute("title", `${mod.acronym} (${label})`);
  }

  // The badge is an inline <use> sprite with a hashed URL; borrow osu's own copy.
  const badge = document.querySelector(
    ".mod__customised-indicator:not(.oep-mod-badge-clone)",
  );
  if (
    badge instanceof HTMLElement &&
    !chip.querySelector(".mod__customised-indicator")
  ) {
    const copy = /** @type {HTMLElement} */ (badge.cloneNode(true));
    copy.classList.add("oep-mod-badge-clone");
    chip.appendChild(copy);
  }
}
