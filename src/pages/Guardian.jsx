import { useEffect, useRef, useState } from "react";
import { api, store, wsUrl } from "../api.js";
import Icon from "../components/Icon.jsx";
import { LevelBadge } from "../components/Risk.jsx";
import { isNative, notify, ST } from "../native.js";

// The family member's screen. Receives alerts live; never sees the conversation itself.
export default function Guardian({ code: routeCode, go }) {
  const [code, setCode] = useState(() => (routeCode || store.get("watchCode") || "").toUpperCase());
  const [input, setInput] = useState("");
  const [info, setInfo] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [live, setLive] = useState(false);
  const [err, setErr] = useState(null);
  const [alarm, setAlarm] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const audio = useRef(null);

  useEffect(() => { if (routeCode) setCode(routeCode.toUpperCase()); }, [routeCode]);

  useEffect(() => {
    if (!code) return;
    let ws, stop = false, bad = false, retry, reload;
    setErr(null);
    // A code that worked before is never dropped: if the server restarted (or is waking up) we keep
    // waiting until their phone reconnects and restores the pairing. Only a mistyped new code shows an error.
    const confirmed = store.get("watchCode") === code;
    const load = () => api.guardian(code)
      .then((g) => { if (stop) return; setInfo(g); setAlerts(g.alerts); setWaiting(false); store.set("watchCode", code); })
      .catch((e) => {
        if (stop) return;
        if (!confirmed && /unknown/i.test(e.message)) { bad = true; setErr(e.message); setInfo(null); return; }
        setWaiting(true); reload = setTimeout(load, 5000);
      });
    load();
    const connect = () => {
      ws = new WebSocket(wsUrl(`/ws/guardian/${code}`));
      ws.onopen = () => setLive(true);
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === "hello") setAlerts(msg.alerts);
        if (msg.type === "alert") { setAlerts((a) => [msg.alert, ...a.filter((x) => x.id !== msg.alert.id)]); ring(msg.alert); }
      };
      ws.onclose = (e) => { setLive(false); if (!stop && !bad) retry = setTimeout(connect, e.code === 4404 ? 5000 : 2000); };
    };
    connect();
    return () => { stop = true; clearTimeout(retry); clearTimeout(reload); try { ws?.close(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const enableAlerts = async () => {
    try {
      audio.current = audio.current || new (window.AudioContext || window.webkitAudioContext)();
      await audio.current.resume();
      if (isNative) await ST.requestNotifications().catch(() => {});
      else if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
      setAlarm(true);
    } catch { setAlarm(true); }
  };

  const ring = (a) => {
    try { navigator.vibrate?.([400, 150, 400, 150, 400]); } catch { /* ignore */ }
    const ctx = audio.current;
    if (ctx) {
      [0, 0.35, 0.7].forEach((t) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
        o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.3);
      });
    }
    const title = a.kind === "help" ? `${a.protected_name} needs help` : `Scam alert: ${a.protected_name}`;
    if (isNative) { notify(title, a.explanation, `/guardian/${code}`, parseInt(a.id.slice(0, 6), 16)); return; }
    try {
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: a.explanation, tag: a.id, requireInteraction: true });
      }
    } catch { /* some browsers only allow notifications from a service worker */ }
  };

  const acknowledge = async (a) => {
    try {
      const updated = await api.ack(code, a.id, `${info?.guardian_name || "Your family member"} has seen the alert and is calling you now.`);
      setAlerts((list) => list.map((x) => (x.id === a.id ? updated : x)));
    } catch (e) { setErr(e.message); }
  };

  if (!code || (!info && err)) {
    return (
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); setCode(input.trim().toUpperCase()); }}>
        <h1>Watch over someone</h1>
        <p className="muted">Enter the pairing code shown on their phone (Shield screen), or scan its QR code.</p>
        <input className="input code-big" style={{ textAlign: "center" }} value={input} maxLength={8} onChange={(e) => setInput(e.target.value.toUpperCase())} placeholder="ABC123" aria-label="Pairing code" />
        <button className="btn primary block" disabled={input.trim().length < 4}>Start watching</button>
        {err ? <div className="banner bad"><Icon name="alert" />{err}. Ask them to link a family member again.</div> : null}
        <div className="tiny">You'll see a warning and the tactics used, never their conversation.</div>
      </form>
    );
  }

  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h1 style={{ marginBottom: 2 }}>Watching over {info?.protected_name || "…"}</h1>
            <div className="tiny row" style={{ gap: 6 }}>{live ? <><span className="pulse" />Connected</> : "Connecting…"} · code {code}</div>
          </div>
          <Icon name="shield" style={{ width: 36, height: 36, color: "var(--accent)" }} />
        </div>
        {waiting ? <div className="banner info" style={{ marginTop: 12 }}><span className="pulse" />Waiting for {info?.protected_name || "their phone"} to reconnect. Alerts will arrive as soon as it does.</div> : null}
        {!alarm ? (
          <button className="btn primary block" style={{ marginTop: 12 }} onClick={enableAlerts}><Icon name="bell" />Turn on sound and notifications</button>
        ) : <div className="tiny" style={{ marginTop: 8 }}>Sound and notifications are on. Keep this screen open.</div>}
      </div>
      {alerts.length === 0 ? (
        <div className="card empty"><Icon name="check" style={{ width: 28, height: 28 }} /><p>No alerts. You'll be told the moment a call looks like a scam.</p></div>
      ) : alerts.map((a) => (
        <div key={a.id} className={`card alert-card ${a.acknowledged ? "acked" : ""}`} role={a.acknowledged ? undefined : "alert"}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong><Icon name="alert" style={{ width: 18, height: 18, verticalAlign: "-3px" }} /> {a.kind === "help" ? `${a.protected_name} pressed "Help me"` : `${a.protected_name} may be talking to a scammer`}</strong>
            <LevelBadge level={a.level} />
          </div>
          <p style={{ marginTop: 8 }}>{a.scam_type ? <strong>{a.scam_type}. </strong> : null}{a.explanation}</p>
          <div className="row">{a.tactics.map((x) => <span className="chip" key={x}>{x}</span>)}</div>
          <div className="tiny" style={{ marginTop: 8 }}>{new Date(a.at * 1000).toLocaleTimeString()}{a.score != null ? ` · risk ${a.score}/100` : ""} · {a.channel}</div>
          {a.acknowledged
            ? <div className="banner good" style={{ marginTop: 10 }}><Icon name="check" />You told them you're on it.</div>
            : <button className="btn danger block" style={{ marginTop: 10 }} onClick={() => acknowledge(a)}><Icon name="phone" />I'm calling them now</button>}
        </div>
      ))}
      <button className="btn ghost block" onClick={() => { store.set("watchCode", null); setCode(""); setInfo(null); go("/guardian"); }}>Stop watching</button>
    </>
  );
}
