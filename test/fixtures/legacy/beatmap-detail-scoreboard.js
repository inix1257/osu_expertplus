/*
 * Frozen copy of the scoreboard helpers that lived in
 * src/pages/beatmap-detail.js before WS-31 (snapshot of 72c61ac). Read by
 * test/osu/legacy.mjs (legacySource) so the src/osu tests can keep comparing
 * the new helpers against the old code. Not loaded by the userscript; do
 * not edit.
 */

  function _scoreTopFlagFilename(cc) {
    if (!/^[A-Za-z]{2}$/.test(cc || "")) return null;
    const upper = cc.toUpperCase();
    const u1 = (0x1f1e6 + upper.charCodeAt(0) - 65).toString(16);
    const u2 = (0x1f1e6 + upper.charCodeAt(1) - 65).toString(16);
    return `${u1}-${u2}`;
  }

  function _scoreTopRelativeTime(iso) {
    if (!iso) return "";
    try {
      const abs = Math.abs(Date.now() - new Date(iso).getTime());
      if (abs < 3_600_000) return `${Math.round(abs / 60_000)}m`;
      if (abs < 86_400_000) return `${Math.round(abs / 3_600_000)}h`;
      if (abs < 2_592_000_000) return `${Math.round(abs / 86_400_000)}d`;
      if (abs < 31_536_000_000) return `${Math.round(abs / 2_592_000_000)}mo`;
      return `${Math.round(abs / 31_536_000_000)}y`;
    } catch {
      return "";
    }
  }

  function beatmapHitstatColorClassFromLabel(labelRaw) {
    const lab = String(labelRaw).trim().toLowerCase();
    if (!lab) return "";
    if (lab === "mania_perfect") return "oep-score-stats__val--mania-perfect";
    if (lab === "mania_good") return "oep-score-stats__val--mania-good";
    if (lab === "ctb_l") return "oep-score-stats__val--ctb-l";
    if (lab === "ctb_drp") return "oep-score-stats__val--ctb-drp";
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return "oep-score-stats__val--miss";
    if (lab === "meh" || /(^|[^0-9])50([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--50";
    if (lab === "geki" || lab === "max" || lab === "320")
      return "oep-score-stats__val--300";
    if (lab === "katu" || lab === "200") return "oep-score-stats__val--100";
    if (lab === "ok" || /(^|[^0-9])100([^0-9]|$)/.test(lab))
      return "oep-score-stats__val--100";
    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return "oep-score-stats__val--300";
    return "";
  }

  function formatScoreboardModSpeedRate(speedChange) {
    const x = Number(speedChange);
    if (!Number.isFinite(x) || x <= 0) return "";
    const rounded = Math.round(x * 100) / 100;
    let t = String(rounded);
    if (t.includes(".")) t = t.replace(/\.?0+$/, "");
    return `${t}×`;
  }

  function formatScoreboardShortAgo(iso) {
    const then = new Date(iso).getTime();
    if (!Number.isFinite(then)) return "";
    const sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (sec < 45) return "now";
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h`;
    const day = Math.floor(hr / 24);
    if (day < 30) return `${day}d`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo`;
    const y = Math.floor(day / 365);
    if (y < 1) return `${mo}mo`;
    return `${y}y`;
  }

  function hitstatTextFromHeaderLabel(labelRaw, score) {
    const statsSource =
      score?.statistics && typeof score.statistics === "object"
        ? score.statistics
        : score && typeof score === "object"
          ? score
          : {};

    const pick = (...keys) => {
      for (const k of keys) {
        const v = statsSource?.[k];
        if (v != null && v !== "" && Number.isFinite(Number(v)))
          return String(v);
      }
      return "0";
    };

    const hasLazer =
      statsSource?.great != null ||
      statsSource?.perfect != null ||
      statsSource?.ok != null ||
      statsSource?.meh != null ||
      statsSource?.miss != null;

    const n300 = hasLazer
      ? Number(statsSource?.great ?? 0) + Number(statsSource?.perfect ?? 0)
      : statsSource?.count_300 != null
        ? Number(statsSource.count_300)
        : statsSource?.count300 != null
          ? Number(statsSource.count300)
          : Number(statsSource?.count_geki ?? statsSource?.countgeki ?? 0);
    const n100 = hasLazer
      ? Number(statsSource?.ok ?? 0)
      : Number(statsSource?.count_100 ?? statsSource?.count100 ?? 0);
    const n50 = hasLazer
      ? Number(statsSource?.meh ?? 0)
      : Number(statsSource?.count_50 ?? statsSource?.count50 ?? 0);
    const nMiss = hasLazer
      ? Number(statsSource?.miss ?? 0)
      : Number(statsSource?.count_miss ?? statsSource?.countmiss ?? 0);

    const lab = String(labelRaw).trim().toLowerCase();

    // osu standard: prefer exact numeric hit counts.
    if (lab === "miss" || lab === "m" || lab.includes("miss"))
      return String(nMiss);

    if (lab === "mania_perfect")
      return pick("count_geki", "countgeki", "perfect", "great");
    if (lab === "mania_good")
      return pick("count_katu", "countkatu", "good", "great");

    if (
      lab === "ctb_l" ||
      (lab === "l" && getBeatmapPageRuleset() === "fruits")
    )
      return pick("large_tick_hit", "large_bonus");
    if (lab === "ctb_drp" || lab === "drp")
      return pick("small_tick_hit", "small_bonus");

    // Order matters: mania uses `320` and it contains `300`.
    if (lab === "geki" || lab === "max" || lab === "320")
      return pick("count_geki", "countgeki", "perfect", "great");

    if (/(^|[^0-9])300([^0-9]|$)/.test(lab) || lab === "great")
      return String(n300);

    if (lab === "katu" || lab === "200")
      return pick("count_katu", "countkatu", "good", "great");

    if (/(^|[^0-9])100([^0-9]|$)/.test(lab) || lab === "ok")
      return String(n100);

    if (/(^|[^0-9])50([^0-9]|$)/.test(lab) || lab === "meh") return String(n50);

    if (lab.includes("tick") || lab === "tail")
      return pick(
        "large_tick_hit",
        "small_tick_hit",
        "slider_tail_hit",
        "large_tick_miss",
      );

    return "0";
  }

  function leaderboardScoreId(score) {
    if (!score || typeof score !== "object") return null;
    const raw =
      score.id ??
      score.legacy_score_id ??
      score.score_id ??
      score.scoreId ??
      score.scoreID ??
      score.score?.id ??
      score.score?.legacy_score_id ??
      score.score?.score_id ??
      null;
    if (raw == null) return null;
    const n = Number(raw);
    if (Number.isFinite(n)) return n > 0 ? String(n) : null;
    const s = String(raw).trim();
    return s ? s : null;
  }

  function modFullName(acronym) {
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

  function scoreApiIndicatesComboPerfect(score) {
    if (!score || typeof score !== "object") return false;
    if (score.perfect === true) return true;
    if (score.is_perfect_combo === true) return true;
    if (score.legacy_perfect === true) return true;
    return false;
  }

  function scoreHasNonstandardRate(score) {
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

  function speedChangeFromScoreMod(mod) {
    if (mod == null || typeof mod !== "object") return NaN;
    const sc = /** @type {{ settings?: { speed_change?: unknown } }} */ (mod)
      .settings?.speed_change;
    const x = Number(sc);
    return Number.isFinite(x) && x > 0 ? x : NaN;
  }

    function toUnicodeFlagFilename(cc) {
      const c = String(cc || "")
        .trim()
        .toUpperCase();
      if (!/^[A-Z]{2}$/.test(c)) return null;
      const A = c.charCodeAt(0) - 65;
      const B = c.charCodeAt(1) - 65;
      const u1 = 0x1f1e6 + A;
      const u2 = 0x1f1e6 + B;
      return `${u1.toString(16)}-${u2.toString(16)}`;
    }

  function getBeatmapPageBeatmapId() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\/(\d+)/i);
    if (fromHash) return fromHash[2];

    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      const fromPickerHash = href.match(/#(osu|taiko|fruits|mania)\/(\d+)/i);
      if (fromPickerHash) return fromPickerHash[2];
      const fromPath = href.match(/\/beatmaps\/(\d+)/);
      if (fromPath) return fromPath[1];
    }

    const data = readBeatmapsetJson();
    const mode = getBeatmapPageRuleset();
    if (data?.beatmaps?.length) {
      const bm = data.beatmaps.find((b) => b.mode === mode) || data.beatmaps[0];
      if (bm?.id != null) return String(bm.id);
    }

    return null;
  }

  function getBeatmapPageRuleset() {
    const fromHash = location.hash.match(/^#(osu|taiko|fruits|mania)\//i);
    if (fromHash) return fromHash[1].toLowerCase();
    const a = document.querySelector(
      "a.beatmapset-beatmap-picker__beatmap--active",
    );
    if (a) {
      const href = a.getAttribute("href") || "";
      let m = href.match(/#(osu|taiko|fruits|mania)\//i);
      if (m) return m[1].toLowerCase();
      m = href.match(/\/beatmaps\/(\d+)/);
      if (m) {
        const data = readBeatmapsetJson();
        const id = Number(m[1]);
        const found = data?.beatmaps?.find((b) => b.id === id);
        if (found?.mode) return String(found.mode).toLowerCase();
      }
    }
    return "osu";
  }

  function readBeatmapsetJson() {
    const script = qs("#json-beatmapset");
    const raw = script?.textContent?.trim();
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function shouldShowScoreboardModSpeedIndicator(acronym, speed) {
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
      Math.abs(speed - SCOREBOARD_MOD_DEFAULT_SPEED_UP) >
      SCOREBOARD_MOD_SPEED_EPS
    );
  }
