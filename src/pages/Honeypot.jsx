import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useSession } from "../session.jsx";

// After the user hangs up, a fictional persona keeps the scammer busy and collects
// their payment details. In the demo a teammate types the scammer's messages.
export default function Honeypot({ go }) {
  const s = useSession();
  const [turns, setTurns] = useState([]);
  const [ids, setIds] = useState([]);
  const [intel, setIntel] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [summary, setSummary] = useState(null);
  const [share, setShare] = useState(true);
  const [err, setErr] = useState(null);
  const started = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!s.sessionId || started.current === s.sessionId) return;
    started.current = s.sessionId;
    setTurns([]); setIds([]); setIntel([]); setEnded(false); setSummary(null);
    api.honeypotStart(s.sessionId)
      .then((r) => setTurns([{ speaker: "persona", text: r.reply }]))
      .catch((e) => setErr(e.message));
  }, [s.sessionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [turns]);

  if (!s.sessionId) {
    return (
      <div className="card stack">
        <h1>Honeypot</h1>
        <p className="muted">Start a protected call or chat first. When it turns out to be a scam, hand it over and SecondThought keeps the scammer busy while collecting their payment details.</p>
        <button className="btn primary" onClick={() => go("/")}>Go to Shield</button>
      </div>
    );
  }

  const send = async (e) => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg || busy || ended) return;
    setBusy(true); setErr(null); setText("");
    setTurns((t) => [...t, { speaker: "other", text: msg }]);
    try {
      const r = await api.honeypotTurn(s.sessionId, msg);
      if (r.reply) setTurns((t) => [...t, { speaker: "persona", text: r.reply, engine: r.engine }]);
      setIds(r.identifiers || []);
      if (r.intel_matches?.length) setIntel((x) => [...x, ...r.intel_matches]);
      if (r.ended) setEnded(true);
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  const stop = async () => {
    try { setSummary(await api.honeypotStop(s.sessionId, share)); setEnded(true); } catch (e) { setErr(e.message); }
  };
  const hit = new Map(intel.map((i) => [`${i.kind}:${i.value}`, i]));

  return (
    <>
      <div className="banner good"><Icon name="bot" /><div><strong>SecondThought has taken over.</strong> You can put the phone down. A fictional persona is talking to them and never shares real details.</div></div>
      <div className="card">
        <h2>Captured details ({ids.length})</h2>
        {ids.length ? (
          <div className="row">
            {ids.map((i) => {
              const h = hit.get(`${i.kind}:${i.value}`);
              return <span key={`${i.kind}:${i.value}`} className={`chip ${h ? "warn" : ""}`}><strong>{i.kind.toUpperCase()}</strong> {i.value}{h ? ` · in ${h.reports} earlier reports${h.includes_demo_data ? " (demo)" : ""}` : ""}</span>;
            })}
          </div>
        ) : <div className="tiny">Nothing yet. The persona will try to get their UPI ID, account, phone number and links.</div>}
      </div>
      <div className="card">
        <h2>Conversation</h2>
        <div className="transcript" aria-live="polite">
          {turns.map((t, i) => (
            <div key={i} className={`bubble ${t.speaker === "persona" ? "persona" : "other"}`}>
              <span className="who">{t.speaker === "persona" ? `Persona${t.engine ? ` (${t.engine === "llm" ? "AI" : "scripted"})` : ""}` : "Scammer"}</span>{t.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {!ended ? (
          <form className="row" style={{ marginTop: 10 }} onSubmit={send}>
            <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
              placeholder="Type what the scammer says…" aria-label="Scammer's message" />
            <button className="btn primary" disabled={busy || !text.trim()}>Send</button>
          </form>
        ) : null}
      </div>
      {!summary ? (
        <div className="card stack">
          <label className="row"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} style={{ width: 20, height: 20 }} />
            Share the scammer's details (not yours) with the network so others are warned</label>
          <button className="btn block" onClick={stop}><Icon name="x" />Stop the honeypot</button>
        </div>
      ) : (
        <div className="card stack">
          <div className="banner good"><Icon name="check" />Stopped after {summary.scammer_messages} scammer messages. {summary.report ? `${summary.report.identifiers} detail(s) added to the intel network.` : "Nothing shared."}</div>
          <button className="btn primary block" onClick={() => go("/report")}><Icon name="file" />Create the complaint report</button>
          <button className="btn block" onClick={() => go("/intel")}><Icon name="graph" />See it in the intel graph</button>
        </div>
      )}
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
    </>
  );
}
