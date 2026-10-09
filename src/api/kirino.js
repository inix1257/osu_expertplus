/**
 * api.kirino.sh "inspector" profile (ranked-score rank and more), used by the
 * profile header's extra rankings.
 */

export const INSPECTOR_PROFILE_URL =
  "https://api.kirino.sh/inspector/extension/profile";

/** Requests give up after this long so the UI never waits forever (B52). */
export const TIMEOUT_MS = 10_000;

const MODE_INDEX = Object.freeze({ osu: 0, taiko: 1, fruits: 2, mania: 3 });

/**
 * Kirino's ruleset index (osu 0, taiko 1, fruits 2, mania 3; unknown → 0).
 * @param {string} ruleset
 * @returns {number}
 */
export function modeIndexForRuleset(ruleset) {
  const n = MODE_INDEX[ruleset];
  return typeof n === "number" ? n : 0;
}

/**
 * Aborts on `signal` or after `ms`, whichever comes first.
 * @param {AbortSignal|undefined} signal
 * @param {number} ms
 * @returns {AbortSignal}
 */
function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeout]);
  }
  const ac = new AbortController();
  const abort = () => ac.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeout.addEventListener("abort", abort, { once: true });
  if (signal.aborted) ac.abort();
  return ac.signal;
}

/**
 * POST the inspector profile request.
 * @param {string|number} userId
 * @param {number} modeIndex  see `modeIndexForRuleset`
 * @param {string} [username]
 * @param {{ signal?: AbortSignal, timeoutMs?: number,
 *   fetchImpl?: typeof fetch }} [options]
 * @returns {Promise<any>}  parsed JSON
 */
export async function fetchInspectorProfile(
  userId,
  modeIndex,
  username = "",
  options = {},
) {
  /** @type {RequestInit} */
  const init = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: String(userId),
      mode: modeIndex,
      username: String(username || ""),
    }),
    signal: withTimeout(options.signal, options.timeoutMs ?? TIMEOUT_MS),
  };
  const resp = await (options.fetchImpl
    ? options.fetchImpl(INSPECTOR_PROFILE_URL, init)
    : fetch(INSPECTOR_PROFILE_URL, init));
  if (!resp.ok) {
    throw new Error(
      `[osu! Expert+] Kirino inspector ${resp.status}: ${INSPECTOR_PROFILE_URL}`,
    );
  }
  return resp.json();
}
