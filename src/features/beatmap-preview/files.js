/**
 * Files a preview loads: the .osu text and the cover as a same-origin blob
 * URL (WS-51).
 */
/**
 * @param {string|number} beatmapId
 * @returns {Promise<string>}
 */
export async function fetchOsuFileText(beatmapId) {
  const resp = await OsuExpertPlus.api.fetchBeatmapOsuFile(beatmapId);
  if (!resp.ok) {
    throw new Error(`Could not download .osu (${resp.status})`);
  }
  return resp.text();
}

/**
 * @param {string|undefined|null} url
 * @returns {string}
 */
export function absoluteUrl(url) {
  if (!url) return "";
  const s = String(url).trim();
  if (!s) return "";
  if (s.startsWith("//")) return `https:${s}`;
  return s;
}

/** Revoked when loading another map or disposing the preview UI. */
let beatmapCoverObjectUrl = null;

export function revokeBeatmapCoverObjectUrl() {
  if (beatmapCoverObjectUrl) {
    try {
      URL.revokeObjectURL(beatmapCoverObjectUrl);
    } catch (_) {
      void 0;
    }
    beatmapCoverObjectUrl = null;
  }
}

/**
 * Cross-origin cover URLs taint pixels; Pixi WebGL upload then throws "The operation is insecure".
 * Load bytes into a blob: URL (same-origin for WebGL).
 * Prefer GM_xmlhttpRequest first when available so we do not hit `fetch` on hosts without ACAO
 * (avoids a failed CORS request and console noise before the GM fallback).
 *
 * @param {string} absUrl
 * @returns {Promise<string>} object URL or "" if unavailable
 */
export async function fetchBeatmapCoverObjectUrl(absUrl) {
  if (!absUrl) return "";
  revokeBeatmapCoverObjectUrl();

  /** @returns {Promise<ArrayBuffer>} */
  function gmGetArrayBuffer() {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest !== "function") {
        reject(new Error("no-gm"));
        return;
      }
      GM_xmlhttpRequest({
        method: "GET",
        url: absUrl,
        responseType: "arraybuffer",
        onload(r) {
          if (r.status >= 200 && r.status < 300 && r.response) {
            resolve(r.response);
          } else {
            reject(new Error(String(r.status)));
          }
        },
        onerror: () => reject(new Error("xhr")),
      });
    });
  }

  try {
    let buf;
    if (typeof GM_xmlhttpRequest === "function") {
      try {
        buf = await gmGetArrayBuffer();
      } catch (gmErr) {
        const res = await fetch(absUrl, {
          credentials: "include",
          mode: "cors",
        });
        if (!res.ok) throw new Error(String(res.status), { cause: gmErr });
        buf = await res.arrayBuffer();
      }
    } else {
      const res = await fetch(absUrl, {
        credentials: "include",
        mode: "cors",
      });
      if (!res.ok) throw new Error(String(res.status));
      buf = await res.arrayBuffer();
    }
    const blob = new Blob([buf]);
    beatmapCoverObjectUrl = URL.createObjectURL(blob);
    return beatmapCoverObjectUrl;
  } catch (_) {
    return "";
  }
}
