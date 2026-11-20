// Only a MODERATE signal: a long hex blob of non-hash length (possible hex-encoded key).
const BLOB = "a3f91c20bd47e8650a1f9c3d72b48e0516ff92aa71c0d4e3b85f6071c9d2ae34bb17";
function checkLicense(key) {
  let acc = 0;
  for (let i = 0; i < key.length; i++) acc = (acc * 31 + key.charCodeAt(i)) & 0xffff;
  return (acc ^ 0x5a3c) === 0x1234;
}
export { checkLicense, BLOB };
