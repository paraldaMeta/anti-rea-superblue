# server-lock — the real lock (SuperBlue L1)

A working reference for the **only** layer that actually stops both REA-class
decompilation *and* Craft-class behavioural cloning. L0–L3 raise the attacker's
cost; **L1 removes the target from the client entirely.**

## The idea

Everything valuable and secret lives on a server you control. The client ships
only a **public key** (safe to leak) and a network request.

| What | Where it lives | Can attacker get it from the client? |
|---|---|---|
| License-minting secret (`SERVER_SECRET`) | server only | No — can't forge license keys |
| Token-signing private key | server only | No — can't forge tokens |
| The valuable computation (`premiumTransform`) | server only | No — nothing to decompile or clone |
| Public key | shipped in client | Yes, but it's useless for forging |

## Why this beats REA and Craft

- **REA (read the client in full):** recovers a thin network shim + a public key.
  There is no secret, no key, and no algorithm in the bundle to recover.
- **Craft (clone observed behaviour):** a perfect behavioural clone of the client
  still has to call your server, which still demands a valid, signed, unexpired
  token. The capability was never in the client to copy.
- **Patch the local gate (`isLicensed()` → true):** bypasses only the UX gate. The
  value is produced server-side and returned only to holders of a valid token, so
  the patched client unlocks *nothing*.

## Files

- `src/keygen.mjs` — generates the Ed25519 keypair + server secret. Private key and
  secret go to `secrets/` (server-only); public key to `client-dist/` (shippable).
- `src/token.mjs` — sign (needs private key) / verify (needs only public key).
- `src/server.mjs` — the authority: license validation, token minting, and the
  premium compute. **Hold this box; it is now the thing to protect.**
- `src/client.mjs` — the shippable client. Contains no secret, no private key, no
  premium logic.
- `src/demo.mjs` — end-to-end + four attacks (forge license, forge token, patch
  gate, clone client) that all fail.

## Strength tier 8 (default)

`server-lock/src/config.mjs` — `STRENGTH_TIER=8` (default): **5 min** tokens, **90s** challenges,
**autoban @50**. Override with env `TOKEN_TTL_MS`, `CHALLENGE_TTL_MS`, `AUTOBAN_THRESHOLD`.

Posture score: `node ../scripts/strength-8-check.mjs <your-module.js> --json` (from repo root).

## Run

```bash
node src/keygen.mjs    # once — mint keys
node src/demo.mjs      # end-to-end proof + attack suite
# or run the live server:
node src/server.mjs    # http://localhost:8787
```

## Honest boundaries (what this does NOT magically solve)

1. **You must now protect the server.** The secret didn't disappear — it moved to
   the one place you control and can monitor/rotate/revoke. That's the whole point.
2. **Offline use is a tradeoff.** Short-lived tokens give a grace window; within it a
   captured token works on its bound device. Shorter TTL + device binding + server
   revocation narrow this; pure-offline products can't fully close it.
3. **Availability/latency cost.** Gated features need the server reachable. Cache the
   *token*, never the *capability*, for any value you actually want to protect.
4. **A license *check* is always client-bypassable.** Only running the *valuable work*
   server-side (as `premium` does) makes the bypass worthless. If a feature can run
   fully offline, it can be unlocked offline — no cryptography changes that.

## Can you "strike back" / trace the attacker? (active defense)

Two very different things:

- ❌ **Hack-back is out.** Logic bombs, remote code execution, destroying the
  attacker's machine, exfiltrating their data — illegal almost everywhere (US CFAA,
  etc.) and technically futile: REA/Craft run your code in an isolated, often
  network-blocked, throwaway sandbox, so a payload hits a VM, not a person, and only
  creates liability for *you*. This repo does **not** do this.
- ✅ **Attribution + traceback + revocation is in** (`watermark.mjs`, telemetry in
  `server.mjs`, demo `trace-demo.mjs`). Legal, standard, and effective:

  | Technique | What it catches |
  |---|---|
  | **Per-recipient watermark** (unique build id) | a leaked/analyzed copy → the ONE buyer it was issued to |
  | **Tiered honeytokens** (T1 plaintext / T2 base64 / T3 split) | which decoy trips reveals *how deep* they dug; combined with request **velocity** it grades intent: low (casual probe) → medium (real extraction) → high (automated/batch harvesting). Server returns a *generic* failure so the attacker learns nothing |
  | **Hardware attestation** (proof-of-possession) | the token is bound to a **non-exportable** secure-element key (TPM 2.0 / Apple Secure Enclave / Android StrongBox / WebAuthn). Every call signs a fresh one-time challenge; a copied/stolen token on another machine **cannot sign** → `device-not-authorized`. Stronger than a soft fingerprint, which a header could spoof |
  | **Impossible-travel geo** | the same account used from two far-apart locations faster than a jet (>900 km/h) → shared/stolen credentials |
  | **Cumulative threat score + auto-ban** | every anomaly adds points (honeytoken grade, PoP failure, impossible travel, sharing); crossing a configurable threshold (`AUTOBAN_THRESHOLD`, default 100) **auto-revokes** the account |
  | **Canary beacon** | the watermarked build was loaded/run in a non-isolated env → phones home with ip/UA (a *signal*, defeated by network isolation) |
  | **Revocation (kill switch)** | per-token (`jti`) or per-user; stateless tokens made instantly revocable server-side (manual or automatic) |
  | **Signed forensic report** (`/forensics`) | an Ed25519-**signed**, tamper-evident evidence trail (graded flags, timestamps, ip, score). Verify independently with the public key via `verify-report.mjs`; one changed byte breaks the signature |

  ```bash
  node src/trace-demo.mjs                         # full flow: attribute, grade, auto-ban, sign
  node src/verify-report.mjs builds/forensics.bob.signed.json   # verify an evidence report
  ```

  **Hardware attestation in production** — swap the in-process demo key in
  `attestation.mjs` for a real secure element: TPM 2.0 (Windows/Linux AIK), Apple
  Secure Enclave + App Attest / DeviceCheck, Android Key Attestation / StrongBox, or
  a WebAuthn/FIDO2 platform passkey. The server flow (`/challenge` → sign → verify)
  is unchanged; only where the private key lives changes.

  Honest limit: the *reliable* attribution is **server-side** (the lock already routes
  every use through you). Client-side canaries are a bonus signal, not a guarantee — a
  careful analyst runs your code offline and never pings back.

## Where this plugs into SuperBlue

SuperBlue's L1 is *advice* precisely because it can't be bolted on by a tool — it's an
architecture decision. This folder is the concrete implementation of that advice.
Use L0 (contain leaks) + L2 (harden the thin client) around it; skip L3 for anything
that ships to CI (the tarpit's poison source map trips scanners).
