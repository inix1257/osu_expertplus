import { test } from "node:test";
import assert from "node:assert/strict";
import { loadScripts } from "./helpers/load-script.mjs";

/**
 * Loads auth.js with a controllable token endpoint.
 * `respond(body)` returns `{ ok, status, json?, text? }` for each token POST
 * (body is the URLSearchParams); it may return a Promise to delay.
 */
function loadAuth(respond) {
  const requests = [];
  const fetch = async (url, init) => {
    requests.push(new URLSearchParams(String(init.body)));
    return respond(requests.at(-1));
  };
  const { OsuExpertPlus, gmStore } = loadScripts(["src/utils/auth.js"], {
    globals: { fetch },
  });
  return { auth: OsuExpertPlus.auth, gmStore, requests };
}

const okToken = (token) => ({
  ok: true,
  status: 200,
  json: async () => ({ access_token: token, expires_in: 3600 }),
});
const unauthorized = () => ({
  ok: false,
  status: 401,
  text: async () => "invalid_client",
});

test("verifyAndSaveCredentials saves only after a token is issued (B33)", async () => {
  const { auth, gmStore } = loadAuth((body) =>
    body.get("client_secret") === "good" ? okToken("t1") : unauthorized(),
  );
  await assert.rejects(auth.verifyAndSaveCredentials("1", "bad"), /401/);
  assert.equal(gmStore.has("oep_client_id"), false);
  assert.equal(auth.getStatus(), "unset");

  await auth.verifyAndSaveCredentials(" 1 ", "good");
  assert.equal(gmStore.get("oep_client_id"), "1");
  assert.equal(gmStore.get("oep_client_secret"), "good");
  assert.equal(await auth.getToken(), "t1"); // stored, no new request
  assert.equal(auth.getClientId(), "1");
  assert.equal(auth.hasSecret(), true);
  assert.equal(auth.getStatus(), "ok");
});

test("an empty secret keeps the saved one when verifying", async () => {
  const { auth, gmStore, requests } = loadAuth(() => okToken("t"));
  auth.setCredentials("1", "saved");
  await auth.verifyAndSaveCredentials("2", "");
  assert.equal(requests.at(-1).get("client_secret"), "saved");
  assert.equal(gmStore.get("oep_client_id"), "2");
});

test("a failed token request is cached instead of retried every call", async () => {
  const { auth, requests } = loadAuth(unauthorized);
  auth.setCredentials("1", "bad");
  await assert.rejects(auth.getToken(), /401/);
  await assert.rejects(auth.getToken(), /401/);
  assert.equal(await auth.getAuthHeader().catch(() => null), null);
  assert.equal(requests.length, 1);
  assert.equal(auth.getStatus(), "error");
  auth.setCredentials("1", "other"); // new credentials clear the failure
  assert.equal(auth.getStatus(), "ok");
  await assert.rejects(auth.getToken());
  assert.equal(requests.length, 2);
});

test("concurrent getToken calls share one request", async () => {
  const { auth, requests } = loadAuth(() => okToken("t"));
  auth.setCredentials("1", "s");
  const [a, b] = await Promise.all([auth.getToken(), auth.getToken()]);
  assert.equal(a, "t");
  assert.equal(b, "t");
  assert.equal(requests.length, 1);
});

test("a token for old credentials is not stored after they change (B34)", async () => {
  let release;
  const { auth, gmStore } = loadAuth((body) =>
    body.get("client_secret") === "old"
      ? new Promise((r) => {
          release = () => r(okToken("old-token"));
        })
      : okToken("new-token"),
  );
  auth.setCredentials("1", "old");
  const pending = auth.getToken();
  await new Promise((r) => setTimeout(r, 0));
  auth.setCredentials("1", "new");
  release();
  assert.equal(await pending, "new-token");
  assert.equal(gmStore.get("oep_access_token"), "new-token");
  assert.equal(await auth.getToken(), "new-token");
});
