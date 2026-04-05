/** URL → page module; re-inits on SPA navigation. */

window.OsuExpertPlus = window.OsuExpertPlus || {};

OsuExpertPlus.Router = class Router {
  constructor() {
    /** @type {{ pattern: RegExp, module: { name: string, init: function } }[]} */
    this._routes = [
      {
        pattern: /^\/home\/account\/edit/,
        module: OsuExpertPlus.pages.accountEdit,
      },
      {
        pattern: /^\/beatmapsets\/(\d+)/,
        module: OsuExpertPlus.pages.beatmapDetail,
      },
      {
        pattern: /^\/beatmapsets(?:\/?)(?!\d)/,
        module: OsuExpertPlus.pages.beatmapsetsListing,
      },
      {
        pattern: /^\/users\//,
        module: OsuExpertPlus.pages.userProfile,
      },
    ];

    this._currentPath = null;
    this._cleanupFn = null;
  }

  /** Start the router, run the matching module, and watch for SPA navigation. */
  init() {
    this._navigate(location.pathname);
    this._watchNavigation();
  }

  _navigate(path) {
    if (path === this._currentPath) return;
    this._currentPath = path;

    // Previous module cleanup
    if (typeof this._cleanupFn === 'function') {
      try { this._cleanupFn(); } catch (_) {}
      this._cleanupFn = null;
    }

    for (const route of this._routes) {
      const match = path.match(route.pattern);
      if (match) {
        try {
          const result = route.module.init(match);
          if (result && typeof result.then === 'function') {
            result.then((fn) => {
              // Ignore cleanup if path changed before async init finished
              if (this._currentPath === path) {
                this._cleanupFn = typeof fn === 'function' ? fn : null;
              } else if (typeof fn === 'function') {
                try { fn(); } catch (_) {}
              }
            }).catch(() => {});
          } else {
            this._cleanupFn = typeof result === 'function' ? result : null;
          }
        } catch (_) {}
        return;
      }
    }
  }

  /** pushState/replaceState wrap, popstate (clears path first), + pathname poll (Inertia may cache pre-wrap history). */
  _watchNavigation() {
    const navigate = this._navigate.bind(this);

    const wrap = (original) =>
      function (...args) {
        const result = original.apply(this, args);
        navigate(location.pathname);
        return result;
      };

    history.pushState = wrap(history.pushState);
    history.replaceState = wrap(history.replaceState);

    // Back/forward: clear path so dedupe cannot skip the event
    window.addEventListener('popstate', () => {
      this._currentPath = null;
      navigate(location.pathname);
    });

    // Pathname poll: catches history calls that bypass our wrap; 200ms + dedupe avoids double init
    let _polledPath = location.pathname;
    setInterval(() => {
      const path = location.pathname;
      if (path !== _polledPath) {
        _polledPath = path;
        navigate(path);
      }
    }, 200);
  }
};
