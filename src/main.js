/**
 * Bundle entry (esbuild). The imported files are still plain scripts that
 * attach themselves to `window.OsuExpertPlus`, so this order is the load order
 * (it replaces the old FILES list in build.js): a module must come after the
 * modules it reads at load time.
 *
 * New ES modules reach the scripts through `./core/bridge.js`, which must stay
 * the first import (ES imports are hoisted, so assignments in this file's body
 * would run after every script had loaded).
 */

import "./core/bridge.js";
import { Router } from "./core/router.js";
import "./utils/dom.js";
import "./utils/difficulty-colours.js";
import "./utils/auth.js";
import "./utils/api.js";
import "./utils/omdb.js";
import "./utils/settings.js";
import "./utils/beatmap-preview.js";
import "./utils/beatmap-card-extra.js";
import "./utils/beatmap-card-stats.js";
import "./utils/mod-icons-as-acronyms.js";
import "./utils/beatmapsets-listing-mode.js";
import "./utils/nav-recent-notification.js";
import "./pages/beatmapsets-listing.js";
import "./pages/beatmap-detail.js";
import { beatmapDiscussion } from "./pages/beatmap-discussion.js";
import "./pages/user-profile.js";
import "./pages/account-edit.js";
import "./ui/settings-panel.js";

const { OsuExpertPlus } = window;

OsuExpertPlus.pages.beatmapDiscussion = beatmapDiscussion;

OsuExpertPlus.settingsPanel.init();
OsuExpertPlus.modIconsAsAcronyms.install(OsuExpertPlus.settings);
OsuExpertPlus.beatmapsetsListingMode.installLinkPatcher();
OsuExpertPlus.navRecentNotification.install(OsuExpertPlus.settings);

new Router(OsuExpertPlus.pages).init();
