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
  | **Honeytoken** (fake license baked into the binary) | anyone who scraped the binary and tries the decoy key → instant attacker attribution; server returns a *generic* failure so they learn nothing |
  | **Canary beacon** | the watermarked build was loaded/run in a non-isolated env → phones home with ip/UA (a *signal*, defeated by network isolation) |
  | **Server-side telemetry** | token sharing / cloned clients (one token, many device fingerprints), impossible velocity, abnormal call patterns |
  | **Revocation (kill switch)** | per-token (`jti`) or per-user; stateless tokens made instantly revocable server-side |
  | **Forensic report** (`/forensics`) | an evidence trail (timestamps, ip, UA, flags) for your lawyer / a platform abuse team |

  ```bash
  node src/trace-demo.mjs   # two watermarked builds -> trace a leak to the exact buyer
  ```

  Honest limit: the *reliable* attribution is **server-side** (the lock already routes
  every use through you). Client-side canaries are a bonus signal, not a guarantee — a
  careful analyst runs your code offline and never pings back.

## Where this plugs into SuperBlue

SuperBlue's L1 is *advice* precisely because it can't be bolted on by a tool — it's an
architecture decision. This folder is the concrete implementation of that advice.
Use L0 (contain leaks) + L2 (harden the thin client) around it; skip L3 for anything
that ships to CI (the tarpit's poison source map trips scanners).
