// Thin client for the SecondThought backend (same origin in production, proxied in dev).

// In the Android app the UI is bundled inside the APK, so API calls go to the deployed
// server (VITE_API_BASE, set in .env.android). In the browser they stay same-origin.
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const BUSY = "The SecondThought server is busy or starting up. Please try again in a minute.";
const UNREACHABLE = "Can't reach the SecondThought server right now. Check the internet connection and try again.";

async function request(method, path, body, attempt = 0) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error(UNREACHABLE);
  }
  // The free server answers 502/503/504 while it restarts: read-only requests are retried once.
  if ([502, 503, 504].includes(res.status)) {
    if (method === "GET" && attempt === 0) { await new Promise((r) => setTimeout(r, 2500)); return request(method, path, body, 1); }
    throw new Error(BUSY);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const detail = data && data.detail;
    const msg = typeof detail === "string" ? detail : Array.isArray(detail) ? detail.map((d) => d.msg).join("; ") : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  health: () => request("GET", "/api/health"),
  metrics: () => request("GET", "/api/metrics"),
  scenarios: () => request("GET", "/api/scenarios"),
  createSession: (body) => request("POST", "/api/sessions", body),
  session: (id) => request("GET", `/api/sessions/${id}`),
  utterance: (id, text, speaker = "other") => request("POST", `/api/sessions/${id}/utterance`, { text, speaker }),
  dismiss: (id) => request("POST", `/api/sessions/${id}/dismiss`),
  endSession: (id) => request("DELETE", `/api/sessions/${id}`),
  paymentCheck: (body) => request("POST", "/api/payment-check", body),
  pair: (protected_name, guardian_name) => request("POST", "/api/guardian/pair", { protected_name, guardian_name }),
  // Pairings live in the server's memory; after a restart the phone puts its own pairing back.
  // Servers that support it put a forgotten pairing back under the same code; older servers hand out a
  // new code instead, which we must not use (the family member's screen watches the old one).
  restorePair: async (g) => {
    const r = await request("POST", "/api/guardian/pair", { protected_name: g.protected_name, guardian_name: g.guardian_name, restore_code: g.code });
    if (r.code !== g.code) throw new Error("pairing could not be restored");
    return r;
  },
  guardian: (code) => request("GET", `/api/guardian/${encodeURIComponent(code)}`),
  ack: (code, alert_id, message) => request("POST", `/api/guardian/${encodeURIComponent(code)}/ack`, { alert_id, message }),
  honeypotStart: (id) => request("POST", `/api/sessions/${id}/honeypot/start`),
  honeypotTurn: (id, text) => request("POST", `/api/sessions/${id}/honeypot/turn`, { text }),
  honeypotStop: (id, share_with_network) => request("POST", `/api/sessions/${id}/honeypot/stop`, { share_with_network }),
  report: (id, body) => request("POST", `/api/sessions/${id}/report`, body),
  check: (text) => request("POST", "/api/check", { text }),
  graph: () => request("GET", "/api/graph"),
  lookup: (kind, value) => request("GET", `/api/graph/lookup?kind=${encodeURIComponent(kind)}&value=${encodeURIComponent(value)}`),
  help: (code, caller_hint, note) => request("POST", `/api/guardian/${encodeURIComponent(code)}/help`, { caller_hint, note }),
};

export function wsUrl(path) {
  if (API_BASE) return API_BASE.replace(/^http/, "ws") + path;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}${path}`;
}

// Small persistent store; storage can be unavailable (private mode, previews), so never rely on it.
export const store = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(`st:${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(`st:${key}`);
      else localStorage.setItem(`st:${key}`, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },
};

// Runs fn(); if the server has forgotten the family pairing (it restarted), restores it and tries once more.
export async function withPairing(guardian, fn) {
  try {
    return await fn();
  } catch (e) {
    if (!guardian || !/guardian/i.test(e.message)) throw e;
    await api.restorePair(guardian);
    return fn();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Keeps trying while the free server wakes up (up to about 75 s). Real "no" answers (4xx) are not retried.
export async function retryWhileWaking(fn, tries = 15) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (e) {
      const network = /fetch|network|load failed|\(50[234]\)/i.test(e.message);
      if (!network || i >= tries - 1) throw e;
      await sleep(5000);
    }
  }
}

// Same rules the server uses for Indian numbers: 10 digits → +91…, 0XXXXXXXXXX → +91…, 91XXXXXXXXXX → +91…
export function normalizePhone(raw) {
  const plus = (raw || "").trim().startsWith("+");
  const d = (raw || "").replace(/\D/g, "");
  if (plus) return "+" + d;
  if (d.length === 10) return "+91" + d;
  if (d.length === 11 && d.startsWith("0")) return "+91" + d.slice(1);
  if (d.length === 12 && d.startsWith("91")) return "+" + d;
  return d ? "+" + d : "";
}

// Is this number in the scam-report network? Uses the long-standing lookup endpoint; nothing is stored.
export async function callerCheck(number) {
  const n = normalizePhone(number);
  if (n.replace(/\D/g, "").length < 6) return { verdict: "unknown", reports: 0, reporters: 0 };
  const hit = await api.lookup("phone", n);
  const reports = hit.reports || 0, reporters = hit.reporters || 0;
  return { verdict: reporters >= 3 ? "reported" : reports ? "seen" : "unknown", reports, reporters, includes_demo_data: Boolean(hit.includes_demo_data) };
}

// Live alert through the server, if this server supports it. Never throws.
export async function serverHelp(guardian, callerHint) {
  if (!guardian?.code) return false;
  try { await withPairing(guardian, () => api.help(guardian.code, callerHint)); return true; } catch { return false; }
}
