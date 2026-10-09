/**
 * Exposes the ES modules under `src/core` (and later `src/osu`, `src/editor`)
 * to the legacy scripts as `OsuExpertPlus.core`. `src/main.js` imports this
 * before any legacy script: ES imports are hoisted, so an assignment in the
 * body of main.js would run only after every script had already loaded.
 */

import * as lifecycle from "./lifecycle.js";
import { createLogger, log } from "./log.js";
import { observe } from "./observe.js";
import * as pageHooks from "./page-hooks.js";
import * as pageWindow from "./page-window.js";
import * as routes from "./routes.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
window.OsuExpertPlus.core = Object.freeze({
  createLogger,
  lifecycle,
  log,
  observe,
  pageHooks,
  pageWindow,
  routes,
});
