import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, store, wsUrl } from "./api.js";

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [sessionId, setSessionId] = useState(null);
  const [snap, setSnap] = useState(null);
  const [turns, setTurns] = useState([]);           // transcript kept on the device only
  const [channel, setChannel] = useState(null);
  const [ack, setAck] = useState(null);             // guardian acknowledgement message
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const [guardian, setGuardianState] = useState(() => store.get("guardian"));
  const [region, setRegionState] = useState(() => store.get("region", "IN"));
  const wsRef = useRef(null);
  const idRef = useRef(null);

  const setGuardian = useCallback((g) => { setGuardianState(g); store.set("guardian", g); }, []);
  const setRegion = useCallback((r) => { setRegionState(r); store.set("region", r); }, []);

  const closeSocket = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ignore */ } }
    setConnected(false);
  }, []);

  const openSocket = useCallback((id) => {
    closeSocket();
    const ws = new WebSocket(wsUrl(`/ws/session/${id}`));
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "state") setSnap(msg);
      else if (msg.type === "guardian_ack") setAck(msg.message);
      else if (msg.type === "error") setError(msg.error);
    };
    ws.onclose = (e) => {
      setConnected(false);
      if (e.code === 4404) {
        // the server no longer knows this session (it expired or the server restarted)
        if (idRef.current === id) {
          idRef.current = null; wsRef.current = null;
          setSessionId(null); setSnap(null); setTurns([]); setChannel(null); setAck(null);
          setError("That protected call ended on the server (it expired or the server restarted). Start a new one.");
        }
        return;
      }
      // reconnect while this session is still the current one
      setTimeout(() => { if (idRef.current === id && wsRef.current === ws) openSocket(id); }, 1500);
    };
  }, [closeSocket]);

  const start = useCallback(async (ch) => {
    setError(null);
    setTurns([]); setSnap(null); setAck(null);
    let res;
    try {
      res = await api.createSession({ channel: ch, region, guardian_code: guardian?.code || null });
    } catch (e) {
      if (guardian && /guardian/i.test(e.message)) {
        // the server restarted and forgot the pairing: continue without it
        setGuardian(null);
        res = await api.createSession({ channel: ch, region });
      } else throw e;
    }
    idRef.current = res.session_id;
    setSessionId(res.session_id);
    setChannel(ch);
    openSocket(res.session_id);
    return res.session_id;
  }, [region, guardian, openSocket, setGuardian]);

  const send = useCallback(async (text, speaker = "other") => {
    const id = idRef.current;
    const clean = (text || "").trim();
    if (!id || !clean) return;
    setTurns((t) => [...t, { speaker, text: clean, at: Date.now() }]);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "utterance", text: clean, speaker }));
    } else {
      try { setSnap(await api.utterance(id, clean, speaker)); } catch (e) { setError(e.message); }
    }
  }, []);

  const dismiss = useCallback(async () => {
    const id = idRef.current;
    if (!id) return;
    try { setSnap(await api.dismiss(id)); } catch (e) { setError(e.message); }
  }, []);

  const reset = useCallback(async (forget = false) => {
    const id = idRef.current;
    idRef.current = null;
    closeSocket();
    if (forget && id) { try { await api.endSession(id); } catch { /* ignore */ } }
    setSessionId(null); setSnap(null); setTurns([]); setChannel(null); setAck(null);
  }, [closeSocket]);

  useEffect(() => () => closeSocket(), [closeSocket]);

  const value = useMemo(() => ({
    sessionId, snap, turns, channel, ack, connected, error, guardian, region,
    setGuardian, setRegion, start, send, dismiss, reset, setError,
  }), [sessionId, snap, turns, channel, ack, connected, error, guardian, region, setGuardian, setRegion, start, send, dismiss, reset]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}
