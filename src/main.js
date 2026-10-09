/**
 * Bundle entry (esbuild). The imported files are still plain scripts that
 * attach themselves to `window.OsuExpertPlus`, so this order is the load order
 * (it replaces the old FILES list in build.js): a module must come after the
 * modules it reads at load time.
 *
 * New ES modules are bridged onto the namespace *before* the script imports,
 * e.g.:
 *   import * as osu from "./osu/index.js";
 *   window.OsuExpertPlus = window.OsuExpertPlus || {};
 *   window.OsuExpertPlus.osu = osu;
 */

import "./utils/dom.js";
import "./utils/html-sanitize.js";
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
import "./pages/user-profile.js";
import "./pages/account-edit.js";
import "./router.js";
import "./ui/settings-panel.js";

const { OsuExpertPlus } = window;

OsuExpertPlus.settingsPanel.init();
OsuExpertPlus.modIconsAsAcronyms.install(OsuExpertPlus.settings);
OsuExpertPlus.beatmapsetsListingMode.installLinkPatcher();
OsuExpertPlus.navRecentNotification.install(OsuExpertPlus.settings);

const router = new OsuExpertPlus.Router();
router.init();
