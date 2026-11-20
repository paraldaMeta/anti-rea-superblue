#!/usr/bin/env node
// Read Electron fuses from a packaged app (requires @electron/fuses). Falls back to checklist.
import { spawnSync } from "node:child_process";

const appPath = process.argv[2];
if (!appPath) {
  console.error("usage: node check-electron-fuses.mjs <path-to-packaged-app-or-exe>");
  process.exit(2);
}

const checklist = [
  "EnableNodeCliInspectArguments → false",
  "RunAsNode → false",
  "EnableEmbeddedAsarIntegrityValidation → true",
  "OnlyLoadAppFromAsar → true",
];

async function main() {
  try {
    const { readFuses } = await import("@electron/fuses");
    const fused = readFuses(appPath);
    console.log("Fuse read:", JSON.stringify(fused, null, 2));
    process.exit(0);
  } catch {
    console.log("(@electron/fuses not installed — npm i -D @electron/fuses)");
    console.log("\nManual fuse checklist for:", appPath);
    for (const c of checklist) console.log("  [ ]", c);
    console.log("\nAfter pack: npx @electron/fuses read", appPath);
    process.exit(0);
  }
}
main();