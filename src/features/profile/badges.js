/**
 * Profile badges strip: collapse toggle (WS-42).
 */

import { observe } from "../../core/observe.js";
import { KEYS, getBool, setBool } from "../../core/storage.js";
import { el, manageStyle } from "../legacy.js";
const PROFILE_BADGES_COLLAPSE_STYLE_ID =
  "osu-expertplus-profile-badges-collapse";
const PROFILE_BADGES_WRAP_CLASS = "oep-profile-badges-wrap";
const PROFILE_BADGES_DONE_ATTR = "data-oep-profile-badges-done";

const PROFILE_BADGES_COLLAPSE_CSS = `
  .${PROFILE_BADGES_WRAP_CLASS} {
    position: relative;
  }
  .${PROFILE_BADGES_WRAP_CLASS}--collapsed .profile-badges {
    display: none;
  }
  .${PROFILE_BADGES_WRAP_CLASS}--collapsed {
    min-height: 36px;
  }
  .oep-profile-badges-toggle {
    position: absolute;
    z-index: 5;
    top: 8px;
    right: 8px;
  }
`;
const badgesCollapseStyle = manageStyle(
  PROFILE_BADGES_COLLAPSE_STYLE_ID,
  PROFILE_BADGES_COLLAPSE_CSS,
);

function injectProfileBadgesCollapseStyles() {
  badgesCollapseStyle.inject();
}

function removeProfileBadgesCollapseStyles() {
  badgesCollapseStyle.remove();
}

/**
 * @param {HTMLElement} badgesRoot  .profile-badges
 */
function enhanceProfileBadgesStrip(badgesRoot) {
  if (badgesRoot.hasAttribute(PROFILE_BADGES_DONE_ATTR)) return;
  if (!badgesRoot.classList.contains("profile-badges")) return;

  const parent = badgesRoot.parentNode;
  if (!parent) return;

  const shell = el("div", { class: PROFILE_BADGES_WRAP_CLASS });
  parent.insertBefore(shell, badgesRoot);
  shell.appendChild(badgesRoot);

  const collapsedStored = getBool(KEYS.PROFILE_BADGES_COLLAPSED);
  if (collapsedStored) {
    shell.classList.add(`${PROFILE_BADGES_WRAP_CLASS}--collapsed`);
  }

  const toggleBtn = el(
    "button",
    {
      type: "button",
      class: "btn-circle oep-profile-badges-toggle",
      "aria-expanded": collapsedStored ? "false" : "true",
      title: collapsedStored ? "Show profile badges" : "Hide profile badges",
    },
    el("span", {
      class: collapsedStored ? "fas fa-chevron-down" : "fas fa-chevron-up",
    }),
  );

  shell.appendChild(toggleBtn);
  badgesRoot.setAttribute(PROFILE_BADGES_DONE_ATTR, "1");

  const applyToggleUi = (collapsed) => {
    const icon = toggleBtn.querySelector(".fas");
    if (icon) {
      icon.className = collapsed ? "fas fa-chevron-down" : "fas fa-chevron-up";
    }
    toggleBtn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    toggleBtn.title = collapsed ? "Show profile badges" : "Hide profile badges";
  };

  toggleBtn.addEventListener("click", () => {
    const collapsed = shell.classList.toggle(
      `${PROFILE_BADGES_WRAP_CLASS}--collapsed`,
    );
    setBool(KEYS.PROFILE_BADGES_COLLAPSED, collapsed);
    applyToggleUi(collapsed);
  });
}

function teardownProfileBadgesCollapse() {
  document
    .querySelectorAll(`.${PROFILE_BADGES_WRAP_CLASS}`)
    .forEach((shell) => {
      const badges = shell.querySelector(".profile-badges");
      const shellParent = shell.parentNode;
      if (badges && shellParent) {
        badges.removeAttribute(PROFILE_BADGES_DONE_ATTR);
        shellParent.insertBefore(badges, shell);
      }
      shell.remove();
    });
  removeProfileBadgesCollapseStyles();
}

/**
 * @returns {function}
 */
export function startProfileBadgesCollapseManager() {
  injectProfileBadgesCollapseStyles();

  const scan = () => {
    document.querySelectorAll(".profile-badges").forEach((node) => {
      if (
        node instanceof HTMLElement &&
        !node.hasAttribute(PROFILE_BADGES_DONE_ATTR)
      ) {
        enhanceProfileBadgesStrip(node);
      }
    });
  };

  scan();
  const ac = new AbortController();
  observe.subscribe(
    {
      selector: ".profile-badges",
      schedule: "sync",
      signal: ac.signal,
      label: "profile/badges",
    },
    scan,
  );

  return () => {
    ac.abort();
    teardownProfileBadgesCollapse();
  };
}
