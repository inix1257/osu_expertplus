/** Remember beatmap listing gamemode (URL `m=`) and default new visits + nav links. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.beatmapsetsListingMode = (() => {
  const STORAGE_KEY = "beatmapsetsListing.preferredMode";
  /** Written when the user picks “Any” so it does not fall back to osu (0). */
  const STORED_ANY = "any";
  /** `GM_getValue` default only — never persisted; missing key → treat as osu (0). */
  const STORED_UNSET = "__oep_bms_mode_unset__";
  const LISTING_PATH_RE = /^\/beatmapsets\/?$/i;

  /**
   * @returns {string|null}  ruleset id `0`–`3`, or `null` when the user chose Any
   */
  function getPreferredMode() {
    const v = GM_getValue(STORAGE_KEY, STORED_UNSET);
    if (v === STORED_UNSET) return "0";
    if (v === STORED_ANY) return null;
    const s = String(v);
    if (/^[0123]$/.test(s)) return s;
    return "0";
  }

  /** @param {string|null} m */
  function setPreferredMode(m) {
    if (m == null || m === "") {
      GM_setValue(STORAGE_KEY, STORED_ANY);
    } else if (/^[0123]$/.test(m)) {
      GM_setValue(STORAGE_KEY, m);
    }
  }

  function isBeatmapsetsListingPath(pathname) {
    return LISTING_PATH_RE.test(pathname);
  }

  function hasAdvancedBeatmapSearch() {
    const el = document.querySelector(
      '.js-react[data-react="beatmaps"][data-advanced-search="1"]',
    );
    return el != null;
  }

  /**
   * Mode row: grid is general → mode → …; sticky bar is status → mode.
   * @param {Element} a
   */
  function isModeFilterAnchor(a) {
    return (
      !!a.closest(
        ".beatmapsets-search__filter-grid > .beatmapsets-search-filter:nth-child(2)",
      ) ||
      !!a.closest(
        ".beatmapsets-search--sticky .beatmapsets-search__filters > .beatmapsets-search-filter:nth-child(2)",
      )
    );
  }

  function persistFromListingLocation() {
    if (!isBeatmapsetsListingPath(location.pathname)) return;
    const m = new URLSearchParams(location.search).get("m");
    if (m == null || m === "") {
      setPreferredMode(null);
    } else if (/^[0123]$/.test(m)) {
      setPreferredMode(m);
    }
    patchListingAnchors();
  }

  function patchListingAnchors() {
    const pref = getPreferredMode();
    const nodes = document.querySelectorAll('a[href*="/beatmapsets"]');
    for (const a of nodes) {
      if (!(a instanceof HTMLAnchorElement)) continue;
      let u;
      try {
        u = new URL(a.href);
      } catch (_) {
        continue;
      }
      if (u.hostname !== "osu.ppy.sh") continue;
      if (!LISTING_PATH_RE.test(u.pathname)) continue;
      if (u.searchParams.has("m")) continue;
      if (pref == null) continue;
      u.searchParams.set("m", pref);
      const rel = u.pathname + u.search + u.hash;
      const attr = a.getAttribute("href");
      if (attr != null && /^https?:\/\//i.test(attr)) {
        a.href = u.toString();
      } else {
        a.setAttribute("href", rel);
      }
    }
  }

  let linkMo = null;
  let linkDebounce = 0;

  /**
   * Keeps “Beatmap listing” (and similar) links aligned with the saved `m` param.
   * @returns {() => void}
   */
  function installLinkPatcher() {
    const schedule = () => {
      window.clearTimeout(linkDebounce);
      linkDebounce = window.setTimeout(patchListingAnchors, 200);
    };
    patchListingAnchors();
    linkMo = new MutationObserver(schedule);
    linkMo.observe(document.documentElement, { childList: true, subtree: true });
    return () => {
      linkMo?.disconnect();
      linkMo = null;
      window.clearTimeout(linkDebounce);
      linkDebounce = 0;
    };
  }

  /**
   * Listing page: apply saved mode when URL has no `m`, and record filter clicks.
   * @returns {() => void}
   */
  function startPageBehavior() {
    let applied = false;
    /** @type {MutationObserver|null} */
    let mo = null;
    let moDebounce = 0;
    let cap = 0;

    const tryApplyPreferred = () => {
      if (applied) return;
      if (!isBeatmapsetsListingPath(location.pathname)) return;
      if (!hasAdvancedBeatmapSearch()) {
        applied = true;
        return;
      }
      const pref = getPreferredMode();
      if (pref == null) {
        applied = true;
        return;
      }
      const cur = new URLSearchParams(location.search).get("m");
      if (cur != null && cur !== "") {
        applied = true;
        return;
      }
      const el = document.querySelector(
        `a.beatmapsets-search-filter__item[data-filter-value="${CSS.escape(pref)}"]`,
      );
      if (!(el instanceof HTMLElement)) return;
      el.click();
      applied = true;
    };

    const onMo = () => {
      window.clearTimeout(moDebounce);
      moDebounce = window.setTimeout(() => {
        tryApplyPreferred();
        if (applied && mo) {
          mo.disconnect();
          mo = null;
        }
      }, 60);
    };

    tryApplyPreferred();
    if (!applied) {
      mo = new MutationObserver(onMo);
      mo.observe(document.body, { childList: true, subtree: true });
    }

    cap = window.setTimeout(() => {
      mo?.disconnect();
      mo = null;
      applied = true;
    }, 20000);

    const onDocClick = (e) => {
      if (!isBeatmapsetsListingPath(location.pathname)) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      const a = t.closest("a.beatmapsets-search-filter__item");
      if (!(a instanceof HTMLAnchorElement)) return;
      if (!isModeFilterAnchor(a)) return;
      window.setTimeout(persistFromListingLocation, 200);
    };

    document.addEventListener("click", onDocClick, true);

    return () => {
      mo?.disconnect();
      window.clearTimeout(moDebounce);
      window.clearTimeout(cap);
      document.removeEventListener("click", onDocClick, true);
    };
  }

  return {
    getPreferredMode,
    installLinkPatcher,
    startPageBehavior,
    patchListingAnchors,
  };
})();
