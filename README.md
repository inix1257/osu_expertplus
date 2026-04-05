because i couldn't be bothered to make 100 PRs

# Install

1. Install a userscript manager — [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) are the ones that work reliably. [Greasemonkey](https://addons.mozilla.org/firefox/addon/greasemonkey/) (Firefox) usually **won’t** play nice: v4+ uses a different async storage API than this script expects.
2. [Download the script](https://github.com/inix1257/osu_expertplus/raw/refs/heads/main/dist/osu-expertplus.user.js) to install.

# osu! Expert+

A userscript for [osu.ppy.sh](https://osu.ppy.sh). Some QoL changes are included.

## Features

**Beatmap Cards** (profiles & `/beatmapsets`)

- Play count & favourite count always visible (no hover needed)
- Extra info: source, BPM, drain length
- Star rating range pills per mode
- Full numbers instead of abbreviated (159,915 not 159.9K)

**User Profile**

- PP to two decimal places + colour-coded hit stats on score rows
- Modded star ratings next to difficulty names (needs API credentials)
- Mod letters instead of icons (HD, DT, …)
- Option to hide the Classic (CL) mod
- Beatmap cover art as score card background
- Score place number (#1, #2, …) on rank cards

**Beatmap Detail**

- Discussion pages default to the Total tab
- OMDB difficulty ratings & star voting (needs an OMDB API key)
- Expandable gameplay preview on beatmapset pages
