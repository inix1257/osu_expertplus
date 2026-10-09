#!/usr/bin/env node
/**
 * Bundles src/main.js with esbuild into dist/osu-expertplus.user.js, prefixed
 * with the userscript metadata block (@version comes from package.json), and
 * writes the local dev loader next to it.
 *
 * Run:  npm run build              release build + dev loader
 *       npm run build:dev          same, with an inline source map (never commit)
 *       npm run check:dist         rebuild in memory, compare with dist on disk
 */

const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = __dirname;
const ENTRY = path.join(ROOT, "src", "main.js");
const OUT = path.join(ROOT, "dist", "osu-expertplus.user.js");
// Local dev loader: same metadata, but @require's the built file from disk so
// Tampermonkey picks up every rebuild on page reload. Machine-specific, so it
// is gitignored. Needs "Allow access to file URLs" for Tampermonkey.
const DEV_OUT = path.join(ROOT, "dist", "osu-expertplus.dev.user.js");

const { version } = JSON.parse(
  fs.readFileSync(path.join(ROOT, "package.json"), "utf8"),
);

// Public install URL (GitHub raw). Change owner/repo/branch if your fork differs.
const INSTALL_BASE =
  "https://raw.githubusercontent.com/inix1257/osu_expertplus/main/dist/osu-expertplus.user.js";

const METADATA = `\
// ==UserScript==
// @name         osu! Expert+
// @namespace    https://github.com/inix1257/osu_expertplus
// @version      ${version}
// @description  Adds extra QoL features to osu.ppy.sh
// @author       inix1257
// @homepageURL  https://github.com/inix1257/osu_expertplus
// @supportURL   https://github.com/inix1257/osu_expertplus/issues
// @downloadURL  ${INSTALL_BASE}
// @updateURL    ${INSTALL_BASE}
// @match        https://osu.ppy.sh/*
// @connect      omdb.nyahh.net
// @connect      assets.ppy.sh
// @connect      api.kirino.sh
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

'use strict';
`;

const toLf = (text) => text.replace(/\r\n?/g, "\n");

/**
 * @param {{ sourcemap?: boolean }} [opts]
 * @returns {Promise<string>} the complete userscript text (LF line endings)
 */
async function bundle({ sourcemap = false } = {}) {
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    bundle: true,
    format: "iife",
    charset: "utf8",
    minify: false,
    legalComments: "inline",
    target: ["chrome120", "firefox120"],
    banner: { js: toLf(METADATA) },
    sourcemap: sourcemap ? "inline" : false,
    write: false,
    logLevel: "warning",
  });
  return toLf(result.outputFiles[0].text);
}

function buildDevLoader() {
  const fileUrl = "file:///" + OUT.replace(/\\/g, "/").replace(/^\//, "");
  const header = toLf(METADATA)
    .replace(/\n'use strict';\n$/, "\n")
    .replace(/^\/\/ @name .*$/m, (line) => `${line} (dev)`)
    .replace(/^\/\/ @(downloadURL|updateURL) .*\n/gm, "")
    .replace(
      "// ==/UserScript==",
      `// @require      ${fileUrl}\n// ==/UserScript==`,
    );
  fs.writeFileSync(DEV_OUT, header, "utf8");
  console.log(`Built → ${DEV_OUT}`);
}

async function build({ sourcemap }) {
  const text = await bundle({ sourcemap });
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, text, "utf8");
  console.log(`Built → ${OUT}`);
  buildDevLoader();
}

/** Release check: the committed dist must equal a fresh build of the sources. */
async function checkDist() {
  const expected = await bundle();
  const actual = fs.existsSync(OUT) ? toLf(fs.readFileSync(OUT, "utf8")) : "";
  if (actual === expected) {
    console.log(`dist is up to date (${path.relative(ROOT, OUT)})`);
    return;
  }
  const a = actual.split("\n");
  const e = expected.split("\n");
  let line = 0;
  while (line < a.length && line < e.length && a[line] === e[line]) line += 1;
  console.error(
    `dist is stale: first difference at line ${line + 1}. Run \`npm run build\`.`,
  );
  process.exitCode = 1;
}

const args = new Set(process.argv.slice(2));
(args.has("--check-dist")
  ? checkDist()
  : build({ sourcemap: args.has("--sourcemap") })
).catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
