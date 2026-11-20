// Bytenode / V8 bytecode profile (AREA). Advisory + optional compile helper output.
export function bytenodeProfileScan(targetPath) {
  return {
    profile: "bytenode",
    recommended: [
      "Install bytenode: npm i bytenode",
      "Compile hot paths: npx bytenode -c hot-path.js → hot-path.jsc",
      "Ship loader stub only; ship no plaintext for compiled modules",
      "Keep oracle equivalence on the .jsc behaviour in CI",
    ],
    honestNote: "Bytecode blocks Wakaru-style JS recovery; determined analysts can still dump at runtime. Combine with L1 server-side for secrets.",
    compileExample: "npx bytenode -c ./src/secret-logic.js -o ./dist/secret-logic.jsc",
  };
}

export function bytenodeProfileMarkdown(scan) {
  return `# Bytenode profile (SuperBlue)\n\n${scan.recommended.map((x) => `- ${x}`).join("\n")}\n\n\`\`\`bash\n${scan.compileExample}\n\`\`\`\n\n${scan.honestNote}\n`;
}