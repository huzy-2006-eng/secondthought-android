import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, store, withPairing, wsUrl } from "./api.js";
import { getEngine } from "./engine/browser.js";

// A protected conversation is scored ON THE PHONE by the same rules and models as the server.
// Nothing is sent anywhere while you talk. The server is used only when a feature needs it:
//   * a linked family member must be alerted (only once the phone has found a scam),
//   * you hand the scammer over to the honeypot, or prepare a complaint report.
// Then the conversation so far is replayed to the server (it masks codes and card numbers on arrival).
// Payment details the other person gives (UPI IDs, numbers, links) are looked up in the scam-report
// network when online; your words and the conversation text are not.

const SessionContext = createContext(null);
const newId = () => "local-" + Math.random().toString(36).slice(2, 10);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [snap, setSnapState] = useState(null);
  const [turns, setTurns] = useState([]);           // transcript kept on the device only
  const [channel, setChannel] = useState(null);
  const [ack, setAck] = useState(null);             // guardian acknowledgement message
  const [connected, setConnected] = useState(false); // connected to the server (only when a feature needed it)
  const [serverLinked, setServerLinked] = useState(false);
  const [error, setError] = useState(null);
  const [guardian, setGuardianState] = useState(() => store.get("guardian"));
  const [region, setRegionState] = useState(() => store.get("region", "IN"));
  const wsRef = useRef(null);
  const idRef = useRef(null);
  const convRef = useRef(null);
  const turnsRef = useRef([]);
  const serverRef = useRef({ id: null, pending: null, alerted: false });
  const intelRef = useRef(new Set());

  const setGuardian = useCallback((g) => { setGuardianState(g); store.set("guardian", g); }, []);
  const setRegion = useCallback((r) => { setRegionState(r); store.set("region", r); }, []);
  const publish = useCallback((s) => setSnapState(s ? { ...s, on_device: true, guardian_alerted: serverRef.current.alerted } : s), []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
    setConnected(false);
  }, []);

  const openSocket = useCallback((serverId, localId) => {
    closeSocket();
    const ws = new WebSocket(wsUrl(`/ws/session/${serverId}`));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "state" && msg.guardian_alerted && !serverRef.current.alerted) {
        serverRef.current.alerted = true;
        if (convRef.current && idRef.current === localId) publish(convRef.current.snapshot());
      } else if (msg.type === "guardian_ack") setAck(msg.message);
    };
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4404) { if (serverRef.current.id === serverId) { serverRef.current = { id: null, pending: null, alerted: serverRef.current.alerted }; setServerLinked(false); } return; }
      setTimeout(() => { if (idRef.current === localId && wsRef.current === ws) openSocket(serverId, localId); }, 1500);
    };
  }, [closeSocket, publish]);

  /** Create the server copy of this conversation (replaying it) when a server feature needs it. Returns the server id. */
  const ensureServer = useCallback(async () => {
    const localId = idRef.current;
    if (!localId) throw new Error("No protected conversation.");
    const sv = serverRef.current;
    if (sv.id) return sv.id;
    if (sv.pending) return sv.pending;
    sv.pending = (async () => {
      let res;
      try {
        res = await withPairing(guardian, () => api.createSession({ channel: channel || "chat", region, guardian_code: guardian?.code || null }));
      } catch (e) {
        if (guardian && /guardian|code|pairing/i.test(e.message)) { setGuardian(null); res = await api.createSession({ channel: channel || "chat", region }); }
        else throw e;
      }
      let alerted = false;
      for (const t of turnsRef.current) { const r = await api.utterance(res.session_id, t.text, t.speaker); if (r?.guardian_alerted) alerted = true; }
      if (idRef.current !== localId) { api.endSession(res.session_id).catch(() => {}); throw new Error("Conversation ended."); }
      if (convRef.current?.risk.dismissedAt != null) await api.dismiss(res.session_id).catch(() => {});
      serverRef.current = { id: res.session_id, pending: null, alerted: serverRef.current.alerted || alerted };
      if (alerted && convRef.current) publish(convRef.current.snapshot());
      setServerLinked(true);
      openSocket(res.session_id, localId);
      return res.session_id;
    })();
    try { return await sv.pending; } catch (e) { serverRef.current.pending = null; throw e; }
  }, [guardian, region, channel, setGuardian, openSocket, publish]);

  const start = useCallback(async (ch) => {
    setError(null);
    const engine = await getEngine();
    const id = newId();
    convRef.current = engine.conversation(id);
    turnsRef.current = [];
    intelRef.current = new Set();
    serverRef.current = { id: null, pending: null, alerted: false };
    closeSocket();
    setTurns([]); setSnapState(null); setAck(null); setServerLinked(false);
    idRef.current = id;
    setSessionId(id);
    setChannel(ch);
    return id;
  }, [closeSocket]);

  const send = useCallback(async (text, speaker = "other", opts = {}) => {
    const id = idRef.current, conv = convRef.current;
    const clean = (text || "").trim().slice(0, 2000);
    if (!id || !conv || !clean) return;
    const turn = { speaker, text: clean, at: Date.now() };
    turnsRef.current = [...turnsRef.current, turn];
    setTurns(turnsRef.current);
    const s = conv.add(clean, speaker);
    publish(s);

    const sv = serverRef.current;
    if (sv.id) api.utterance(sv.id, clean, speaker).catch(() => {});
    else if (s.intervene && guardian && !sv.pending && !opts.quiet) ensureServer().catch(() => {}); // alert the family member only once it is a scam

    // Payment details the other person gave: look them up in the scam-report network (identifiers only).
    const fresh = (s.new_entities || []).filter((e) => e.shareable && speaker !== "user" && !intelRef.current.has(e.kind + e.value));
    if (fresh.length) {
      fresh.forEach((e) => intelRef.current.add(e.kind + e.value));
      Promise.all(fresh.map((e) => api.lookup(e.kind, e.value).catch(() => null))).then((hits) => {
        const found = hits.filter((h) => h && h.reports > 0).map((h) => ({ kind: h.kind, value: h.value, reports: h.reporters, includes_demo_data: h.includes_demo_data }));
        if (found.length && idRef.current === id) {
          const after = conv.applyIntel(found);
          publish(after);
          if (after.intervene && guardian && !opts.quiet && !serverRef.current.id && !serverRef.current.pending) ensureServer().catch(() => {});
        }
      });
    }
  }, [guardian, ensureServer, publish]);

  const dismiss = useCallback(async () => {
    if (!convRef.current) return;
    publish(convRef.current.dismiss());
    const sid = serverRef.current.id;
    if (sid) api.dismiss(sid).catch(() => {});
  }, [publish]);

  const reset = useCallback(async (forget = false) => {
    const sid = serverRef.current.id;
    idRef.current = null; convRef.current = null; turnsRef.current = [];
    serverRef.current = { id: null, pending: null, alerted: false };
    closeSocket();
    if (sid && forget) { try { await api.endSession(sid); } catch { /* ignore */ } }
    setSessionId(null); setSnapState(null); setTurns([]); setChannel(null); setAck(null); setServerLinked(false);
  }, [closeSocket]);

  useEffect(() => () => closeSocket(), [closeSocket]);

  const value = useMemo(() => ({
    sessionId, snap, turns, channel, ack, connected, serverLinked, error, guardian, region,
    setGuardian, setRegion, start, send, dismiss, reset, setError, ensureServer,
  }), [sessionId, snap, turns, channel, ack, connected, serverLinked, error, guardian, region, setGuardian, setRegion, start, send, dismiss, reset, ensureServer]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
