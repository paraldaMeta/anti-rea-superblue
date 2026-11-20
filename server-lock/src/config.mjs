// Tiered hardening defaults. STRENGTH_TIER=8 → shorter tokens, tighter autoban (operational lock posture).
export const STRENGTH_TIER = Number(process.env.STRENGTH_TIER || 8);
const tier8 = STRENGTH_TIER >= 8;

export const TOKEN_TTL_MS = Number(
  process.env.TOKEN_TTL_MS || (tier8 ? 5 * 60 * 1000 : 10 * 60 * 1000),
);
export const CHALLENGE_TTL_MS = Number(
  process.env.CHALLENGE_TTL_MS || (tier8 ? 90 * 1000 : 2 * 60 * 1000),
);
export const THREAT_THRESHOLD = Number(process.env.AUTOBAN_THRESHOLD || (tier8 ? 50 : 100));
export const REQUIRE_ATTESTATION = process.env.REQUIRE_ATTESTATION !== "0" && tier8;