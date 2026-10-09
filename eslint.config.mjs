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
  OsuExpertPlus: "writable",
};

// Baseline from WS-10: existing code is not fixed here. WS-11 cleans these up
// and promotes the temporary "warn" rules back to errors.
const baselineRules = {
  "no-unused-vars": "warn",
  "no-empty": ["warn", { allowEmptyCatch: true }],
  // `/* global GM_* */` comments in some files repeat the configured globals.
  "no-redeclare": ["error", { builtinGlobals: false }],
  // Temporary (WS-11): existing violations.
  "no-useless-escape": "warn",
  "no-useless-assignment": "warn",
  "preserve-caught-error": "warn",
};

export default [
  { ignores: ["dist/", "web.js", "docs/", "node_modules/"] },
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
      "src/osu/**/*.js",
      "src/editor/**/*.js",
      "src/features/**/*.js",
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
