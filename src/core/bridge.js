/**
 * Exposes the ES modules to the legacy scripts: `src/core` as
 * `OsuExpertPlus.core`, `src/api/kirino.js` as `OsuExpertPlus.kirino`, `src/osu`
 * as `OsuExpertPlus.osu` (and later `src/editor`). `src/main.js` imports this
 * before any legacy script: ES imports are hoisted, so an assignment in the
 * body of main.js would run only after every script had already loaded.
 */

import * as kirino from "../api/kirino.js";
import * as osu from "../osu/index.js";
import * as lifecycle from "./lifecycle.js";
import { createLogger, log } from "./log.js";
import { observe } from "./observe.js";
import * as pageHooks from "./page-hooks.js";
import * as pageWindow from "./page-window.js";
import * as routes from "./routes.js";
import * as storage from "./storage.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
window.OsuExpertPlus.core = Object.freeze({
  createLogger,
  lifecycle,
  log,
  observe,
  pageHooks,
  pageWindow,
  routes,
  storage,
});
window.OsuExpertPlus.kirino = kirino;
window.OsuExpertPlus.osu = osu;
