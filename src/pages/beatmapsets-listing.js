/** /beatmapsets listing (no set id). */

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
      OsuExpertPlus.beatmapCardStats.startAlwaysShowStats(settings, manageStyle),
    );
    bag.add(
      OsuExpertPlus.beatmapCardStats.startFullBeatmapStatNumbers(settings),
    );
    bag.add(OsuExpertPlus.beatmapCardExtra.start(settings));

    return () => bag.dispose();
  }

  return { name, init };
})();
