/** /beatmapsets listing (no set id): card features and the listing mode. */

import { start as startCardExtra } from "../features/cards/extra.js";

window.OsuExpertPlus = window.OsuExpertPlus || {};
OsuExpertPlus.pages = OsuExpertPlus.pages || {};

OsuExpertPlus.pages.beatmapsetsListing = (() => {
  const name = "BeatmapsetsListing";
  const { manageStyle, createCleanupBag } = OsuExpertPlus.dom;
  const settings = OsuExpertPlus.settings;

  /**
   * @param {RegExpMatchArray} _match  URL match (unused here).
   * @returns {function|void}  Optional cleanup function.
   */
  function init(_match) {
    const bag = createCleanupBag();

    bag.add(
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(
        settings,
        manageStyle,
      ),
    );
    bag.add(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );
    bag.add(startCardExtra(settings));
    bag.add(OsuExpertPlus.beatmapsetsListingMode.startPageBehavior());

    return () => bag.dispose();
  }

  return { name, init };
})();
