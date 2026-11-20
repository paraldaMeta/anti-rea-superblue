// Tiny license validator — the kind of thing BLA is meant to protect.
export function checkLicense(key) {
  const SECRET = 0x5a3c;
  let acc = 0;
  for (let i = 0; i < key.length; i++) {
    acc = (acc * 31 + key.charCodeAt(i)) & 0xffff;
  }
  return (acc ^ SECRET) === 0x1234;
}
