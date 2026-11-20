import { checkLicense as orig } from "./license.js";
import { checkLicense as hard } from "./license.fork.js";

const keys = ["", "A", "ABC-123", "hello world", "ZZZZZ", "license-key-9000",
  "\u00e9\u00e8", "0".repeat(100), "KEYS", "demo", "X"];
let mism = 0;
for (let n = 0; n < 5000; n++) {
  const len = n % 24;
  let k = "";
  for (let i = 0; i < len; i++) k += String.fromCharCode(32 + ((n * 7 + i * 13) % 94));
  keys.push(k);
}
for (const k of keys) {
  const a = orig(k), b = hard(k);
  if (a !== b) { mism++; if (mism <= 5) console.log("MISMATCH", JSON.stringify(k), a, b); }
}
console.log(`tested=${keys.length} mismatches=${mism}`);
console.log(mism === 0 ? "RESULT: RUNTIME-EQUIVALENT" : "RESULT: NOT EQUIVALENT");
