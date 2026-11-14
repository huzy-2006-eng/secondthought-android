// ScammerTrap counters, kept on this phone only. Every number is real: it comes from your own use.
import { store } from "./api.js";

const empty = () => ({ sessions: 0, ms: 0, messages: 0, captured: [], reports: 0, shared: 0 });
export const getStats = () => ({ ...empty(), ...(store.get("trapStats") || {}) });
const save = (s) => store.set("trapStats", s);

export function trapStarted() { const s = getStats(); s.sessions += 1; save(s); }
export function trapMessage(sessionStart) {
  const s = getStats(); s.messages += 1;
  s.lastMs = Date.now() - sessionStart;   // time the scammer has spent on this trap so far
  save(s);
}
export function trapCaptured(ids) {
  const s = getStats();
  const set = new Set(s.captured);
  for (const i of ids) set.add(`${i.kind}:${i.value}`);
  s.captured = Array.from(set).slice(-500);
  save(s);
}
export function trapEnded(sessionStart, lastMessageAt) {
  const s = getStats();
  if (lastMessageAt && lastMessageAt > sessionStart) s.ms += lastMessageAt - sessionStart;
  delete s.lastMs;
  save(s);
}
export function reportFiled(shared) { const s = getStats(); s.reports += 1; if (shared) s.shared += 1; save(s); }

export function summary() {
  const s = getStats();
  const sec = Math.round(s.ms / 1000);
  return { wasted: sec < 60 ? `${sec}s` : sec < 3600 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`, minutes: Math.round(s.ms / 60000), messages: s.messages, captured: s.captured.length, reports: s.reports, sessions: s.sessions };
}
