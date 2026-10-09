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

/** `OsuExpertPlus.dom.qs` */
export function qs(...args) {
  return OsuExpertPlus.dom.qs(...args);
}

/** `OsuExpertPlus.dom.parseLocaleNumber` */
export function parseLocaleNumber(...args) {
  return OsuExpertPlus.dom.parseLocaleNumber(...args);
}

/** `OsuExpertPlus.dom.formatDecimalPp` */
export function formatDecimalPp(...args) {
  return OsuExpertPlus.dom.formatDecimalPp(...args);
}
