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

/**
 * The cover blob URL the preview uses, and the cover it was made from.
 * Revoked when another cover replaces it or the preview is reset.
 * @type {{ src: string, objectUrl: string } | null}
 */
let currentCover = null;
/** The cover asked for last; results for older requests are dropped (B32). */
let latestCoverSrc = "";
/** @type {Map<string, Promise<string>>} cover URL -> blob URL being made */
const coverInFlight = new Map();

/** @param {string} objectUrl */
function revokeObjectUrl(objectUrl) {
  try {
    URL.revokeObjectURL(objectUrl);
  } catch (_) {
    void 0;
  }
}

export function revokeBeatmapCoverObjectUrl() {
  latestCoverSrc = "";
  if (currentCover) revokeObjectUrl(currentCover.objectUrl);
  currentCover = null;
}

/**
 * The cover's bytes: GM_xmlhttpRequest when available (no CORS request that
 * would fail without ACAO), else `fetch`. assets.ppy.sh needs no cookies.
 * @param {string} absUrl
 * @returns {Promise<ArrayBuffer>}
 */
async function fetchCoverBytes(absUrl) {
  /** @returns {Promise<ArrayBuffer>} */
  function gmGetArrayBuffer() {
    return new Promise((resolve, reject) => {
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
  const viaFetch = async (cause) => {
    const res = await fetch(absUrl, { credentials: "omit", mode: "cors" });
    if (!res.ok) throw new Error(String(res.status), { cause });
    return res.arrayBuffer();
  };
  if (typeof GM_xmlhttpRequest === "function") {
    try {
      return await gmGetArrayBuffer();
    } catch (gmErr) {
      return viaFetch(gmErr);
    }
  }
  return viaFetch(undefined);
}

/**
 * Cross-origin cover URLs taint pixels; Pixi WebGL upload then throws "The
 * operation is insecure". Load the bytes into a blob: URL (same-origin for
 * WebGL). Requests for the same cover share one download, and a result that
 * is no longer the latest request is revoked instead of leaking (B32).
 * @param {string} absUrl
 * @returns {Promise<string>} object URL, or "" if unavailable or superseded
 */
export async function fetchBeatmapCoverObjectUrl(absUrl) {
  if (!absUrl) return "";
  latestCoverSrc = absUrl;
  if (currentCover?.src === absUrl) return currentCover.objectUrl;

  let pending = coverInFlight.get(absUrl);
  if (!pending) {
    pending = fetchCoverBytes(absUrl)
      .then((buf) => URL.createObjectURL(new Blob([buf])))
      .catch(() => "")
      .finally(() => coverInFlight.delete(absUrl));
    coverInFlight.set(absUrl, pending);
  }
  const objectUrl = await pending;
  if (!objectUrl) return "";
  if (currentCover?.objectUrl === objectUrl) return objectUrl;
  if (latestCoverSrc !== absUrl) {
    revokeObjectUrl(objectUrl);
    return "";
  }
  if (currentCover) revokeObjectUrl(currentCover.objectUrl);
  currentCover = { src: absUrl, objectUrl };
  return objectUrl;
}
