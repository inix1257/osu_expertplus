/**
 * The legacy scripts' helpers for ES feature modules. The scripts attach
 * themselves to `window.OsuExpertPlus` after the ES modules are evaluated,
 * so everything here reads it at call time.
 */

/** @returns {any} `OsuExpertPlus.settings` */
export function settings() {
  return OsuExpertPlus.settings;
}

/** @returns {Record<string, string>} `OsuExpertPlus.settings.IDS` */
export function settingIds() {
  return OsuExpertPlus.settings.IDS;
}

/** `OsuExpertPlus.dom.el` */
export function el(...args) {
  return OsuExpertPlus.dom.el(...args);
}

/** @returns {boolean} whether osu! API OAuth credentials are saved */
export function isAuthConfigured() {
  return OsuExpertPlus.auth.isConfigured();
}

/** `OsuExpertPlus.dom.waitForElement` */
export function waitForElement(...args) {
  return OsuExpertPlus.dom.waitForElement(...args);
}

/** `OsuExpertPlus.dom.setTextIfChanged` */
export function setTextIfChanged(...args) {
  return OsuExpertPlus.dom.setTextIfChanged(...args);
}

/** `OsuExpertPlus.dom.setHiddenIfChanged` */
export function setHiddenIfChanged(...args) {
  return OsuExpertPlus.dom.setHiddenIfChanged(...args);
}
