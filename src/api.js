// Thin client for the SecondThought backend (same origin in production, proxied in dev).

// In the Android app the UI is bundled inside the APK, so API calls go to the deployed
// server (VITE_API_BASE, set in .env.android). In the browser they stay same-origin.
export const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

async function request(method, path, body) {
  const res = await fetch(API_BASE + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
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
  guardian: (code) => request("GET", `/api/guardian/${encodeURIComponent(code)}`),
  ack: (code, alert_id, message) => request("POST", `/api/guardian/${encodeURIComponent(code)}/ack`, { alert_id, message }),
  honeypotStart: (id) => request("POST", `/api/sessions/${id}/honeypot/start`),
  honeypotTurn: (id, text) => request("POST", `/api/sessions/${id}/honeypot/turn`, { text }),
  honeypotStop: (id, share_with_network) => request("POST", `/api/sessions/${id}/honeypot/stop`, { share_with_network }),
  report: (id, body) => request("POST", `/api/sessions/${id}/report`, body),
  check: (text) => request("POST", "/api/check", { text }),
  graph: () => request("GET", "/api/graph"),
  callerCheck: (number) => request("POST", "/api/caller-check", { number }),
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
