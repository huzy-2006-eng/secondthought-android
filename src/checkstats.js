// Counts of messages checked on this phone, by verdict (shown on the home screen gauge). Real use only.
import { store } from "./api.js";
export const getCheckStats = () => ({ scam: 0, suspicious: 0, safe: 0, ...(store.get("checkStats") || {}) });
export function recordCheck(verdict) {
  const s = getCheckStats();
  if (verdict === "scam") s.scam += 1; else if (verdict === "suspicious") s.suspicious += 1; else s.safe += 1;
  store.set("checkStats", s);
}
