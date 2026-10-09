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

/** `OsuExpertPlus.dom.qsa` */
export function qsa(...args) {
  return OsuExpertPlus.dom.qsa(...args);
}

/** @returns {any} `OsuExpertPlus.omdb` */
export function omdb() {
  return OsuExpertPlus.omdb;
}

/** `OsuExpertPlus.dom.manageStyle` */
export function manageStyle(...args) {
  return OsuExpertPlus.dom.manageStyle(...args);
}

/** `OsuExpertPlus.dom.waitForStaleElementToLeave` */
export function waitForStaleElementToLeave(...args) {
  return OsuExpertPlus.dom.waitForStaleElementToLeave(...args);
}

/** `OsuExpertPlus.dom.parseLocaleNumber` */
export function parseLocaleNumber(...args) {
  return OsuExpertPlus.dom.parseLocaleNumber(...args);
}

/** `OsuExpertPlus.dom.formatDecimalPp` */
export function formatDecimalPp(...args) {
  return OsuExpertPlus.dom.formatDecimalPp(...args);
}

/** `OsuExpertPlus.modIconsAsAcronyms.applyModIconsAsAcronyms` */
export function applyModIconsAsAcronyms(...args) {
  return OsuExpertPlus.modIconsAsAcronyms.applyModIconsAsAcronyms(...args);
}

/** `OsuExpertPlus.modIconsAsAcronyms.injectModIconsAcronymStyles` */
export function injectModIconsAcronymStyles(...args) {
  return OsuExpertPlus.modIconsAsAcronyms.injectModIconsAcronymStyles(...args);
}

/** `OsuExpertPlus.modIconsAsAcronyms.stripOepModAcronymFromClonedMod` */
export function stripOepModAcronymFromClonedMod(...args) {
  return OsuExpertPlus.modIconsAsAcronyms.stripOepModAcronymFromClonedMod(
    ...args,
  );
}

/** `OsuExpertPlus.modIconsAsAcronyms.modTypeClassForAcronym` */
export function modTypeClassForAcronym(...args) {
  return OsuExpertPlus.modIconsAsAcronyms.modTypeClassForAcronym(...args);
}
