#!/usr/bin/env node
/**
 * Simple bundle script — concatenates all source files in the correct load
 * order and prepends the userscript metadata block to produce
 * dist/osu-expertplus.user.js.
 *
 * Run:  node build.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist", "osu-expertplus.user.js");

// Files are concatenated in this exact order.
const FILES = [
  "src/utils/dom.js",
  "src/utils/difficulty-colours.js",
  "src/utils/auth.js",
  "src/utils/api.js",
  "src/utils/omdb.js",
  "src/utils/settings.js",
  "src/utils/beatmap-preview.js",
  "src/utils/beatmap-card-extra.js",
  "src/utils/beatmap-card-stats.js",
  "src/utils/mod-icons-as-acronyms.js",
  "src/pages/beatmapsets-listing.js",
  "src/pages/beatmap-detail.js",
  "src/pages/user-profile.js",
  "src/pages/account-edit.js",
  "src/router.js",
  "src/ui/settings-panel.js",
];

// Public install URL (GitHub raw). Change owner/repo/branch if your fork differs.
const INSTALL_BASE =
  "https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js";

const METADATA = `\
// ==UserScript==
// @name         osu! Expert+
// @namespace    https://github.com/inix1257/osu_expertplus
// @version      0.2.5
// @description  Adds extra QoL features to osu.ppy.sh
// @author       inix1257
// @homepageURL  https://github.com/inix1257/osu_expertplus
// @supportURL   https://github.com/inix1257/osu_expertplus/issues
// @downloadURL  ${INSTALL_BASE}
// @updateURL    ${INSTALL_BASE}
// @match        https://osu.ppy.sh/*
// @connect      omdb.nyahh.net
// @connect      assets.ppy.sh
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

'use strict';
`;

function build() {
  const parts = [METADATA];

  for (const relPath of FILES) {
    const absPath = path.join(ROOT, relPath);
    const src = fs
      .readFileSync(absPath, "utf8")
      // Strip 'use strict' directives (already at the top).
      .replace(/^'use strict';\s*/m, "")
      .trimEnd();
    parts.push(`\n/* ── ${relPath} ── */\n${src}`);
  }

  // Entry-point IIFE.
  parts.push(`
/* ── entry point ── */
(function () {
  OsuExpertPlus.settingsPanel.init();
  OsuExpertPlus.modIconsAsAcronyms.install(OsuExpertPlus.settings);

  const router = new OsuExpertPlus.Router();
  router.init();
})();
`);

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, parts.join("\n"), "utf8");
  console.log(`Built → ${OUT}`);
}

build();
