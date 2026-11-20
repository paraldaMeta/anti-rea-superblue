// REA / Craft threat matrix (synthesized from surveyed anti-REA projects).
// Attached to every SuperBlue report so integrators see what is countered vs what
// is NOT — honest, evidence-style, not marketing.
export function buildReaMatrix(report) {
  const L = report.layers || {};
  const l0 = L.L0_contain;
  const l2 = L.L2_harden;
  const l25 = L.L2_5_chaff;
  const l3 = L.L3_tarpit;
  const shippedClean = l2?.containment?.risk === "baseline";
  const tarpitOn = l3?.applied === true;
  const chaffOn = l25?.applied === true;

  const counters = [
    {
      surface: "analyze_javascript_application / recover_javascript_sources",
      attack: "REA reads shipped JS/TS (static graph)",
      counter: "L0 strip/detect source maps; L2 minify; optional L2.5+L3 semantic budget expanders",
      strength: shippedClean && l2?.mangled ? "moderate" : "weak",
      note: "Maps removed = permanent win; obfuscation is readability friction only.",
    },
    {
      surface: "semantic_precision / alias-selections budget",
      attack: "Attacker raises REA budgets in one CLI flag",
      counter: "L2.5 chaff + L3 BLA bankrupt (deeper in this fork)",
      strength: tarpitOn || chaffOn ? "speed-bump-default-budget" : "none",
      note: "Measured: raised budget defeats tarpit in ~15s — not a lock.",
    },
    {
      surface: "trace_application_feature / behavioural replay",
      attack: "Craft Anything clean-room rebuild",
      counter: "L1 server-side authority (server-lock) — NOT client L0–L3",
      strength: "none-client-only",
      note: "Only moving valuable compute + secrets off-device.",
    },
    {
      surface: "compare_application_versions",
      attack: "Diff two builds to recover stable logic",
      counter: "Per-build jitter (BLA seed) + release guard",
      strength: tarpitOn ? "partial" : "weak",
    },
    {
      surface: "observe_web_execution / CDP",
      attack: "Runtime capture of client behaviour",
      counter: "Thin client + server gating; Electron fuse hardening (see AREA/antirea)",
      strength: "architectural",
      note: "SuperBlue does not apply Electron fuses — documented in REFERENCES-SYNTHESIS.",
    },
    {
      surface: "inspect_electron_fuses + --inspect",
      attack: "Attach debugger when fuses allow",
      counter: "Disable inspect / RunAsNode (AREA); not in SuperBlue core",
      strength: "out-of-band",
    },
    {
      surface: "Leaked secrets in bundle",
      attack: "Free recovery of keys/constants",
      counter: "L0 contain scanner (reaproof-style patterns)",
      strength: l0?.risk === "baseline" ? "good" : "failed",
    },
  ];

  const stillVulnerableTo = [
    { threat: "REA with raised semantic budgets", mitigation: "Accept as cost-only; monitor with server-side telemetry" },
    { threat: "Behavioural cloning (Craft)", mitigation: "server-lock L1 — client ships requests only" },
    { threat: "Paid user IO sampling", mitigation: "Rate limits + non-deterministic server responses" },
    { threat: "Server compromise / key leak", mitigation: "HSM, rotation, incident response (out of SuperBlue scope)" },
    { threat: "Fully offline client logic", mitigation: "Cannot lock — move feature server-side or accept bypass" },
  ];

  const surveyBorrowed = [
    { repo: "reaproof", borrowed: "L0 leak taxonomy, fail-safe inline map classifier, expanded secret prefixes" },
    { repo: "DeRea", borrowed: "Optional Docker-isolated verify (verify-docker.mjs); honesty on sampled equivalence" },
    { repo: "anti-rea-forge / releaseguard", borrowed: "Release gate mindset: block ship on CRITICAL; private refs outside dist" },
    { repo: "antirea", borrowed: "strip-dist utility + pre-ship hook template" },
    { repo: "anti-reverse-engineer-anything (AREA)", borrowed: "REA-surface matrix + server-side crown jewels" },
    { repo: "bla-agents / fork", borrowed: "L3 semantic budget breaker (intensity-scaled)" },
    { repo: "server-lock", borrowed: "L1 real lock + active defense patterns (separate package)" },
    { repo: "REAShield", borrowed: "relocate subcommand (thin client + server skeleton)" },
    { repo: "morluto/rea", borrowed: "test-rea subcommand (default timeout vs raised bypass)" },
    { repo: "AREA / 848 anti-rea", borrowed: "--profile electron fuse checklist" },
  ];

  return { counters, stillVulnerableTo, surveyBorrowed, generatedFrom: "superblue/rea-matrix.mjs" };
}