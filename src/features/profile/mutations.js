/**
 * Mutation batch helper shared by the profile features until their observers
 * move to the hub (WS-41).
 */
/**
 * True when a mutation batch contains an added node that matches selector
 * (or contains matching descendants).
 * @param {MutationRecord[]} mutations
 * @param {string} selector
 * @returns {boolean}
 */
export function mutationsIncludeSelector(mutations, selector) {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (!(node instanceof Element)) continue;
      try {
        if (node.matches(selector)) return true;
        if (node.querySelector(selector)) return true;
      } catch (_) {
        // Invalid selectors in third-party markup must not break observers.
      }
    }
  }
  return false;
}
