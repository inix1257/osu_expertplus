import js from "@eslint/js";
import globals from "globals";

const userscriptGlobals = {
  ...globals.browser,
  GM_addStyle: "readonly",
  GM_getValue: "readonly",
  GM_setValue: "readonly",
  GM_deleteValue: "readonly",
  GM_xmlhttpRequest: "readonly",
  unsafeWindow: "readonly",
  // Firefox userscript sandbox (Xray) helpers.
  exportFunction: "readonly",
  cloneInto: "readonly",
  OsuExpertPlus: "writable",
};

const baselineRules = {
  // `_`-prefixed names mark intentionally unused bindings (mostly `catch (_)`).
  "no-unused-vars": [
    "warn",
    {
      argsIgnorePattern: "^_",
      caughtErrorsIgnorePattern: "^_",
    },
  ],
  // Empty catches are handled once WS-20 adds a logger.
  "no-empty": ["warn", { allowEmptyCatch: true }],
  // `/* global GM_* */` comments in some files repeat the configured globals.
  "no-redeclare": ["error", { builtinGlobals: false }],
};

export default [
  {
    ignores: [
      "dist/",
      "docs/",
      "node_modules/",
      "test/fixtures/legacy/",
    ],
  },
  js.configs.recommended,
  {
    // Legacy scripts that attach themselves to window.OsuExpertPlus.
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: userscriptGlobals,
    },
    rules: baselineRules,
  },
  {
    // Bundle entry and new ES module directories.
    files: [
      "src/main.js",
      "src/core/**/*.js",
      "src/api/**/*.js",
      "src/osu/**/*.js",
      "src/editor/**/*.js",
      "src/features/**/*.js",
      "src/pages/beatmap-discussion.js",
      "src/pages/beatmap-detail.js",
      "src/pages/beatmapsets-listing.js",
      "src/pages/user-profile.js",
    ],
    languageOptions: { sourceType: "module" },
  },
  {
    files: ["build.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: baselineRules,
  },
  {
    files: ["test/**/*.{js,mjs}", "eslint.config.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    rules: baselineRules,
  },
];
