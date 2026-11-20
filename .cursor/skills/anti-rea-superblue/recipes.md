# Integration recipes

Copy `server-lock/` from anti-rea-superblue into the user's project. Endpoints to expose
(server-side only): `GET /challenge`, `POST /activate`, `POST /premium`, `POST /revoke`,
`GET /forensics`.

Reuse modules: `token.mjs`, `attestation.mjs`, `report.mjs`, `watermark.mjs`.
Private key + `SERVER_SECRET` in env / secret manager — never in the client bundle.

## Express (minimal)

Mount the same handlers as `server-lock/src/server.mjs`. Replace `premiumTransform` body
with the user's valuable logic (or keep `logic-relocated.mjs`).

## Next.js App Router

- `app/api/activate/route.ts`, `app/api/premium/route.ts` — `export const runtime = "nodejs"`.
- Keys in `process.env` only (never `NEXT_PUBLIC_*`).

## Cloudflare Workers

Workers KV or D1 for revoke lists; Ed25519 sign in Worker with secret binding.
Static SPA calls Worker URL from generated thin client (`makeClient(apiBase)`).

## Electron

Ship **thin client** from `relocate --server-lock`. Main process holds token cache only.
Run fuse checklist: `superblue/scripts/check-electron-fuses.mjs`.

## Oracle template (for R1)

```js
// oracles/my-feature.mjs
export const entry = "myExport";
export function* samples() {
  yield ["input-a"];
  yield ["input-b"];
}
export function equals(a, b) { return a === b; }
```