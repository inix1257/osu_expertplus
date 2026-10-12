![](https://luscentos.s-ul.eu/Mfjdk1dV)

# osu! ExpertPlus (for web)

because i couldn't be bothered to make 200 PRs

note: there might be potential behavior conflicts with other userscripts, so use at your own risk

# Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/) on Chrome, Edge or Firefox is supported. [Violentmonkey](https://violentmonkey.github.io/) usually works too
2. [Download the script](https://github.com/inix1257/osu_expertplus/raw/refs/heads/main/dist/osu-expertplus.user.js) to install. If you have userscript manager installed, you can just click the link and install it

# osu! Expert+

A userscript for [osu.ppy.sh](https://osu.ppy.sh). Some QoL changes are included

## Features

**Beatmap Cards**

- Play count & favourite count always visible
- Extra metadata on beatmap cards (source, BPM, drain length)
- Star rating range per mode
- Full numbers instead of abbreviated (159,915 instead of 159.9K)

**User Profile**

- Collapsible profile badges and sections (me!, Ranks, etc.)
- BBCode helper/live preview for userpage editing
- PP to two decimal places + colour-coded hit stats on score rows
- Modded star ratings next to difficulty names (this one needs API credentials)
- Mod acronyms instead of icons
- Option to hide Classic (CL) mod
- Beatmap background as score card background
- Score place number on rank cards
- Period filter for pinned/top plays

**Beatmap Page**

- Show copyable beatmap metadata and full description
- Show username and avatar on favourite list
- OMDB integration: difficulty ratings & star voting (needs an OMDB API key)
- Gameplay preview on beatmapset pages
- Improved mod selection on beatmapset pages
- Period filter for recent scores on leaderboard
- Better colouring/highlighting for hit statistics on scoreboard
- Show scores up to 100 on leaderboard
- Show beatconnect download button

**Modding Thread**

- Discussion pages default to the Total tab (ranked mapsets usually send you to praise tab by default)
- Markdown/preview support for modding thread
- Show username and avatar on voters list

# Development

Requires Node.js 22.13+.

```sh
npm ci            # dev tools only; nothing from node_modules ships in the userscript
npm run build     # bundles src/main.js → dist/osu-expertplus.user.js (+ local dev loader)
npm run check     # lint + tests + build
```

- `npm run build:dev` builds the same file with an inline source map, for testing in the browser. Don't commit it.
- `npm run build` also writes `dist/osu-expertplus.dev.user.js` (gitignored). Install it in Tampermonkey (with "Allow access to file URLs") to load your local build on every page reload.
- Load order lives in `src/main.js`. New files must be imported there after the modules they use.

**Release** (maintainer only): `npm version patch --no-git-tag-version` → `npm run build` → commit `package.json`, `package-lock.json` and `dist/` on `main`. `npm run check:dist` verifies that the committed `dist/` matches the sources.
