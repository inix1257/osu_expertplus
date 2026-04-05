/** Replace `.mod__icon` sprites with `data-acronym` text (global). */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.modIconsAsAcronyms = (() => {
  const { el } = OsuExpertPlus.dom;
  const { IDS } = OsuExpertPlus.settings;

  const MOD_ICONS_ACRONYM_ID = IDS.MOD_ICONS_AS_ACRONYMS;
  const HIDE_CL_MOD_ID = IDS.HIDE_CL_MOD;
  const MOD_ICONS_ACRONYM_STYLE_ID = "osu-expertplus-mod-acronym-icons";
  const HIDE_CL_MOD_STYLE_ID = "osu-expertplus-hide-cl-mod";
  const MOD_ICONS_ACRONYM_ATTR = "data-oep-mod-acronym";
  const MOD_ICONS_ACRONYM_CLASS = "oep-mod-icon--acronym";
  /** Real text node — osu-web uses ::after for both letters and masked SVGs; those rules tie our specificity. */
  const MOD_ICONS_ACRONYM_LABEL_CLASS = "oep-mod-acronym-label";

  /** Fallback when parent `.mod` has no type (e.g. odd markup); mirrors osu difficulty reduction set. */
  const MOD_ACRONYM_REDUCTION = new Set([
    "EZ",
    "NF",
    "HT",
    "DC",
    "NR",
    "SO",
    "MU",
  ]);
  /** Fallback for difficulty-increasing–style mods (excl. automation / keys → white). */
  const MOD_ACRONYM_INCREASE = new Set([
    "HR",
    "SD",
    "PF",
    "DT",
    "NC",
    "HD",
    "FL",
    "FI",
    "BL",
    "DA",
    "AC",
    "WU",
    "WD",
    "DF",
    "TC",
    "SV2",
    "NS",
    "TP",
    "MF",
    "MG",
    "AD",
    "AS",
    "CS",
    "DS",
    "RD",
    "SI",
    "ST",
    "SY",
    "TD",
    "BM",
    "CO",
    "DP",
    "FR",
    "GR",
    "IN",
    "MR",
    "RP",
    "SW",
    "TR",
    "WG",
    "BR",
    "BU",
  ]);

  const MOD_ICONS_ACRONYM_CSS = `
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon {
      background: none !important;
      background-image: none !important;
      box-shadow: none !important;
      filter: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      width: auto !important;
      max-width: none !important;
      min-width: 0 !important;
      flex-shrink: 0;
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      position: relative;
      padding: 0 0.12em;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::before,
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon::after {
      display: none !important;
      content: none !important;
      mask: none !important;
      -webkit-mask: none !important;
      mask-image: none !important;
      -webkit-mask-image: none !important;
      background: none !important;
      background-image: none !important;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS} {
      font-weight: 900;
      font-size: 0.62em;
      line-height: 1;
      text-transform: uppercase;
      pointer-events: none;
      white-space: nowrap;
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--reduce {
      color: rgb(178, 255, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--increase {
      color: rgb(255, 102, 102);
    }
    .${MOD_ICONS_ACRONYM_CLASS}.mod__icon .${MOD_ICONS_ACRONYM_LABEL_CLASS}--plain {
      color: #fff;
    }
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__extender,
    .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) .mod__customised-indicator {
      display: none !important;
    }
    /*
     * Beatmapset “mod filter” grid (Expert+): osu-web .mod { height: 1em } fits masked icons;
     * acronym labels use real text and can clip or skew flex baseline vs row labels / piles.
     */
    [data-oep-mod-grid] .beatmap-scoreboard-mod {
      display: inline-flex !important;
      align-items: center;
      vertical-align: middle;
    }
    [data-oep-mod-grid]
      .beatmap-scoreboard-mod
      .mod:has(.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]) {
      height: auto !important;
      min-height: 1em;
      align-items: center;
    }
  `;

  /** Classic (CL) — hidden via attribute match; applies with icons or Expert+ acronyms. */
  const HIDE_CL_MOD_CSS = `
    .beatmap-scoreboard-mod:has(.mod__icon[data-acronym="CL" i]),
    .mod:has(> .mod__icon[data-acronym="CL" i]) {
      display: none !important;
    }
  `;

  /** @param {Element} modRoot */
  function modRootHasType(modRoot, typeSuffix) {
    const want = `mod--type-${typeSuffix}`.toLowerCase();
    return modRoot.className.split(/\s+/).some((c) => c.toLowerCase() === want);
  }

  /**
   * Lazer-style mods (DT, HT, …) can show a custom rate in `.mod__extender` (e.g. "1.10×").
   * Fold that into the acronym label so "mod acronyms" mode shows one string and we hide
   * the extender via CSS while `data-oep-mod-acronym` is set (revert restores layout).
   * @param {HTMLElement} modIconEl
   * @param {string} baseAcronym  trimmed `data-acronym`, e.g. "DT"
   */
  function modAcronymDisplayText(modIconEl, baseAcronym) {
    const modRoot = modIconEl.closest(".mod");
    if (!(modRoot instanceof HTMLElement)) return baseAcronym;
    const extSpan = modRoot.querySelector(".mod__extender span");
    const extra = extSpan?.textContent?.trim();
    if (!extra) return baseAcronym;
    return `${baseAcronym} ${extra}`;
  }

  /**
   * @param {HTMLElement} modIconEl
   * @param {string} acronymUpper
   * @returns {"reduce"|"increase"|"plain"}
   */
  function modAcronymTone(modIconEl, acronymUpper) {
    const modRoot = modIconEl.closest(".mod");
    if (modRoot && modRootHasType(modRoot, "DifficultyReduction")) {
      return "reduce";
    }
    if (modRoot && modRootHasType(modRoot, "DifficultyIncrease")) {
      return "increase";
    }
    if (MOD_ACRONYM_REDUCTION.has(acronymUpper)) return "reduce";
    if (MOD_ACRONYM_INCREASE.has(acronymUpper)) return "increase";
    return "plain";
  }

  /** osu-web BEM (PascalCase suffix matches compiled `mod.less`). */
  function modTypeClassForAcronym(acronym) {
    const u = String(acronym).trim().toUpperCase();
    if (MOD_ACRONYM_REDUCTION.has(u)) return "mod--type-DifficultyReduction";
    if (MOD_ACRONYM_INCREASE.has(u)) return "mod--type-DifficultyIncrease";
    return "mod--type-Fun";
  }

  function injectModIconsAcronymStyles() {
    if (document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = MOD_ICONS_ACRONYM_STYLE_ID;
    style.textContent = MOD_ICONS_ACRONYM_CSS;
    document.head.appendChild(style);
  }

  function removeModIconsAcronymStyles() {
    document.getElementById(MOD_ICONS_ACRONYM_STYLE_ID)?.remove();
  }

  function injectHideClModStyles() {
    if (document.getElementById(HIDE_CL_MOD_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = HIDE_CL_MOD_STYLE_ID;
    style.textContent = HIDE_CL_MOD_CSS;
    document.head.appendChild(style);
  }

  function removeHideClModStyles() {
    document.getElementById(HIDE_CL_MOD_STYLE_ID)?.remove();
  }

  /**
   * @param {ParentNode} scope
   */
  function applyModIconsAsAcronyms(scope) {
    const icons = [];
    if (scope instanceof Element && scope.matches(".mod__icon[data-acronym]")) {
      icons.push(scope);
    }
    if (scope.querySelectorAll) {
      scope.querySelectorAll(".mod__icon[data-acronym]").forEach((n) => {
        icons.push(n);
      });
    }
    icons.forEach((node) => {
      if (!(node instanceof HTMLElement)) return;
      if (node.hasAttribute(MOD_ICONS_ACRONYM_ATTR)) return;
      const raw =
        node.getAttribute("data-acronym") || node.dataset?.acronym || "";
      const acronym = String(raw).trim();
      if (!acronym) return;
      node.classList.add(MOD_ICONS_ACRONYM_CLASS);
      node.setAttribute(MOD_ICONS_ACRONYM_ATTR, "1");
      const tone = modAcronymTone(node, acronym.toUpperCase());
      const labelText = modAcronymDisplayText(node, acronym);
      const label = el(
        "span",
        {
          class: `${MOD_ICONS_ACRONYM_LABEL_CLASS} ${MOD_ICONS_ACRONYM_LABEL_CLASS}--${tone}`,
        },
        labelText,
      );
      node.appendChild(label);
    });
  }

  /**
   * @param {ParentNode} scope
   */
  function revertModIconsAsAcronyms(scope) {
    scope
      .querySelectorAll(`.mod__icon[${MOD_ICONS_ACRONYM_ATTR}]`)
      .forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        node.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
        node.classList.remove(MOD_ICONS_ACRONYM_CLASS);
        node.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
      });
  }

  /**
   * deep-cloneNode(true) of osu’s `.mod` can copy Expert+ acronym state from the
   * template row; patch then replaces .mod__icon classes and drops
   * oep-mod-icon--acronym while data-oep-mod-acronym stays → apply skips →
   * sprite + stale label overlap. Strip before patching so apply runs fresh.
   * @param {HTMLElement} modRoot
   */
  function stripOepModAcronymFromClonedMod(modRoot) {
    const icon = modRoot.querySelector(".mod__icon");
    if (!(icon instanceof HTMLElement)) return;
    icon.querySelector(`.${MOD_ICONS_ACRONYM_LABEL_CLASS}`)?.remove();
    icon.classList.remove(MOD_ICONS_ACRONYM_CLASS);
    icon.removeAttribute(MOD_ICONS_ACRONYM_ATTR);
  }

  /**
   * @param {{ isEnabled: function(string): boolean }} settingsApi
   * @returns {function} disconnect
   */
  function startModIconsAcronymObserver(settingsApi) {
    const obs = new MutationObserver((mutations) => {
      if (!settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID)) return;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const elNode = /** @type {Element} */ (node);
          if (elNode.matches?.(".mod__icon[data-acronym]")) {
            applyModIconsAsAcronyms(elNode);
          } else if (elNode.querySelectorAll) {
            applyModIconsAsAcronyms(elNode);
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    return () => obs.disconnect();
  }

  /**
   * Wire setting + document observer for all pages (beatmap leaderboards, profiles, etc.).
   * @param {{ isEnabled: function(string): boolean, onChange: function(string, function(boolean)): function }} settingsApi
   * @returns {function} full teardown
   */
  function install(settingsApi) {
    let stopModIconsAcronymObs = null;
    const applyModIconsAcronymFeature = (enabled) => {
      stopModIconsAcronymObs?.();
      stopModIconsAcronymObs = null;
      if (enabled) {
        injectModIconsAcronymStyles();
        applyModIconsAsAcronyms(document);
        stopModIconsAcronymObs = startModIconsAcronymObserver(settingsApi);
      } else {
        removeModIconsAcronymStyles();
        revertModIconsAsAcronyms(document);
      }
    };
    applyModIconsAcronymFeature(settingsApi.isEnabled(MOD_ICONS_ACRONYM_ID));

    const applyHideClMod = (enabled) => {
      if (enabled) injectHideClModStyles();
      else removeHideClModStyles();
    };
    applyHideClMod(settingsApi.isEnabled(HIDE_CL_MOD_ID));

    const unsub = settingsApi.onChange(
      MOD_ICONS_ACRONYM_ID,
      applyModIconsAcronymFeature,
    );
    const unsubHideCl = settingsApi.onChange(HIDE_CL_MOD_ID, applyHideClMod);
    return () => {
      unsub();
      unsubHideCl();
      stopModIconsAcronymObs?.();
      stopModIconsAcronymObs = null;
      revertModIconsAsAcronyms(document);
      removeModIconsAcronymStyles();
      removeHideClModStyles();
    };
  }

  return {
    applyModIconsAsAcronyms,
    injectModIconsAcronymStyles,
    stripOepModAcronymFromClonedMod,
    modTypeClassForAcronym,
    install,
  };
})();
