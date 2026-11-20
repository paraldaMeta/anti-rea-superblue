// Electron / desktop ship profile (AREA + antirea + 848 anti-rea ideas).
// Advisory checks + fuse checklist — does not modify artifacts.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const FUSE_CHECKLIST = [
  "EnableNodeCliInspectArguments: OFF (block --inspect / CDP attach)",
  "RunAsNode: OFF",
  "EnableEmbeddedAsarIntegrityValidation: ON",
  "LoadAppFromAsar: ON (OnlyLoadAppFromAsar)",
  "NODE_OPTIONS in environment: strip / ignore in packaged build",
];

const ELECTRON_MARKERS = [
  [/electron\.asar|app\.asar/i, "ASAR bundle reference"],
  [/electron[/\\]dist|from\s+["']electron["']/i, "Electron runtime reference"],
  [/contextBridge|ipcRenderer|ipcMain/i, "IPC surface (REA can pair literal channels)"],
  [/nodeIntegration\s*:\s*true/i, "nodeIntegration:true (dangerous in renderer)", "HIGH"],
];

export function electronProfileScan(targetPath) {
  const findings = [];
  let text = "";
  try {
    if (existsSync(targetPath) && !targetPath.endsWith("/")) text = readFileSync(targetPath, "utf8").slice(0, 500_000);
  } catch { /* directory */ }

  for (const row of ELECTRON_MARKERS) {
    const [re, kind, sev] = row;
    if (text && re.test(text)) findings.push({ severity: sev || "MODERATE", kind });
  }

  const actions = [
    "Strip all source maps from app.asar (superblue strip-dist)",
    "Obfuscate main-process JS or compile hot paths to V8 .jsc (bytenode) — optional",
    "Hash IPC channel names at runtime (no literal ipcMain.on('secret',...))",
    "Run bla protect on main bundle with --intensity maximum or bankrupt",
    "Verify fuses after pack: npx @electron/fuses read (or REA inspect_electron_fuses)",
  ];

  return {
    profile: "electron",
    electronSignals: findings.length,
    findings,
    fuseChecklist: FUSE_CHECKLIST,
    recommendedActions: actions,
    honestNote: "Fuses and ASAR integrity raise REA/CDP cost; crown jewels still belong server-side.",
  };
}

export function electronProfileMarkdown(scan) {
  return `# Electron ship profile (SuperBlue)

## Fuse checklist (verify after pack)
${scan.fuseChecklist.map((x) => `- [ ] ${x}`).join("\n")}

## Signals in target
${scan.findings.length ? scan.findings.map((f) => `- [${f.severity}] ${f.kind}`).join("\n") : "- (none in scanned file — scan dist/ directory separately)"}

## Recommended actions
${scan.recommendedActions.map((x) => `- ${x}`).join("\n")}

${scan.honestNote}
`;
}