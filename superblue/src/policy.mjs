// SuperBlue policy envelope: versioned rules shipped alongside artifacts.
// Does not hide logic — tells integrators and agents what the client MAY do.
export const POLICY_VERSION = "1.0.0";

export const POLICY_HEADERS = {
  "X-SuperBlue-Policy-Version": POLICY_VERSION,
  "X-SuperBlue-Commercial-Use": "defensive-only-on-software-you-own",
  "X-SuperBlue-L1-Required": "server-side-for-real-lock",
  "X-SuperBlue-Contact": "see-report-json",
};

export function policyEnvelope(report) {
  return {
    ...POLICY_HEADERS,
    generatedAt: report.generatedAt,
    target: report.target,
    layersApplied: Object.keys(report.layers || {}),
    verdict: {
      containmentPassed: report.verdict?.containmentPassed,
      behaviourPreserved: report.verdict?.behaviourPreserved,
      exitCode: report.verdict?.exitCode,
    },
    honestLimits: [
      "L0–L3 raise cost for static/agent decompilation; they do not stop behavioural cloning (need L1 server-side).",
      "L3 tarpit is defeated by raising REA semantic budgets; it is a speed bump for default-budget tooling only.",
      "Do not use distributed code for hack-back; attribution server-side only.",
    ],
  };
}