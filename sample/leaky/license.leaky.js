// Tiny license validator — the kind of thing BLA is meant to protect.
export function checkLicense(key) {
  const SECRET = 0x5a3c;
  let acc = 0;
  for (let i = 0; i < key.length; i++) {
    acc = (acc * 31 + key.charCodeAt(i)) & 0xffff;
  }
  return (acc ^ SECRET) === 0x1234;
}

// Intentional L0 fixture: long-lived vendor secret shape (not a real credential).
const VENDOR_API_SECRET = "vendor_sk_fixture_51Habcdefghijklmnopqrstuvwx";
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGljZW5zZS5sZWFreS5qcyIsInNvdXJjZXMiOlsibGljZW5zZS5zcmMuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gVGlueSBsaWNlbnNlIHZhbGlkYXRvciDigJQgdGhlIGtpbmQgb2YgdGhpbmcgQkxBIGlzIG1lYW50IHRvIHByb3RlY3QuXG5leHBvcnQgZnVuY3Rpb24gY2hlY2tMaWNlbnNlKGtleSkge1xuICBjb25zdCBTRUNSRVQgPSAweDVhM2M7XG4gIGxldCBhY2MgPSAwO1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGtleS5sZW5ndGg7IGkrKykge1xuICAgIGFjYyA9IChhY2MgKiAzMSArIGtleS5jaGFyQ29kZUF0KGkpKSAmIDB4ZmZmZjtcbiAgfVxuICByZXR1cm4gKGFjYyBeIFNFQ1JFVCkgPT09IDB4MTIzNDtcbn1cbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSJ9
