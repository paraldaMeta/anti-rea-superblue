// Oracle for the license-validator sample: entry + behavioural samples.
export const entry = "checkLicense";
export function* samples() {
  const fixed = ["", "A", "ABC-123", "hello world", "ZZZZZ", "license-key-9000", "demo", "X", String.fromCharCode(0x4808)];
  for (const k of fixed) yield [k];
  // accepting keys (acc === 0x4808) for positive coverage
  for (let a = 32; a < 90; a++) for (let b = 32; b < 90; b++) for (let c = 32; c < 90; c++) {
    let acc = 0; for (const ch of [a, b, c]) acc = (acc * 31 + ch) & 0xffff;
    if ((acc ^ 0x5a3c) === 0x1234) { yield [String.fromCharCode(a, b, c)]; }
  }
  // broad pseudo-random coverage
  for (let n = 0; n < 4000; n++) {
    const len = n % 20; let k = "";
    for (let i = 0; i < len; i++) k += String.fromCharCode(32 + ((n * 7 + i * 13) % 94));
    yield [k];
  }
}
