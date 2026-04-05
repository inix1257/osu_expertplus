// ==UserScript==
// @name         osu! Expert+
// @namespace    https://github.com/inix1257/osu_expertplus
// @version      0.1.0
// @description  Adds convenient extra features to osu.ppy.sh
// @author       inix1257
// @match        https://osu.ppy.sh/*
// @connect      assets.ppy.sh
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @run-at       document-idle
// ==/UserScript==

'use strict';

// build.js concatenates these (order matters)
// @require src/utils/dom.js
// @require src/utils/api.js
// @require src/utils/settings.js
// @require src/utils/mod-icons-as-acronyms.js
// @require src/pages/beatmapsets-listing.js
// @require src/pages/beatmap-detail.js
// @require src/pages/user-profile.js
// @require src/router.js
// @require src/ui/settings-panel.js

(function () {
  OsuExpertPlus.settingsPanel.init();
  OsuExpertPlus.modIconsAsAcronyms.install(OsuExpertPlus.settings);

  const router = new OsuExpertPlus.Router();
  router.init();
})();
