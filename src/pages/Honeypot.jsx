import { useEffect, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import { useSession } from "../session.jsx";
import { shareText, isNative } from "../native.js";
import { getEngine } from "../engine/browser.js";
import { Decoy } from "../trap/persona.js";
import { lookupIdentifiers } from "../localchecks.js";
import { trapCaptured, trapEnded, trapMessage, trapStarted } from "../trapstats.js";
import { store } from "../api.js";

// ScammerTrap: a decoy persona that answers the scammer, wastes their time and draws out their payment
// details. It runs ON THIS PHONE: it reads each message with the detection engine and replies in kind.
// The scammer's messages are not uploaded; only payment details they gave are looked up in the scam network.
// One trap per protected conversation, kept while you visit other screens and come back.
const TRAPS = new Map();

export default function Honeypot({ go }) {
  const s = useSession();
  const [turns, setTurns] = useState([]);
  const [ids, setIds] = useState([]);
  const [intel, setIntel] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(null);
  const [persona, setPersonaState] = useState(() => store.get("trapPersona", "grandmother"));
  const setPersona = (p) => { setPersonaState(p); store.set("trapPersona", p); if (decoy.current) decoy.current.persona = p; };
  const decoy = useRef(null);
  const clock = useRef({ start: 0, last: 0, done: false });
  const endRef = useRef(null);

  useEffect(() => {
    if (!s.sessionId) return;
    let cancelled = false;
    const saved = TRAPS.get(s.sessionId);
    if (saved) {   // back on this screen: continue the same trap
      decoy.current = saved.decoy; clock.current = saved.clock;
      setTurns(saved.turns); setIds(saved.decoy.caught()); setIntel(saved.intel); setEnded(saved.ended); setErr(null);
      return;
    }
    setTurns([]); setIds([]); setIntel([]); setEnded(false); setErr(null);
    getEngine().then((engine) => {
      if (cancelled) return;
      decoy.current = new Decoy(engine, store.get("trapPersona", "grandmother"));
      for (const old of TRAPS.values()) {   // a new trap: count the time the previous one wasted, even if Stop wasn't pressed
        if (old.clock.start && !old.clock.done && old.clock.last) { old.clock.done = true; trapEnded(old.clock.start, old.clock.last); }
      }
      TRAPS.clear();
      TRAPS.set(s.sessionId, { decoy: decoy.current, clock: clock.current, turns: [], intel: [], ended: false });
      // Handed over from a protected call/chat: the decoy already knows what the scam is about.
      const before = (s.turns || []).filter((t) => t.speaker !== "user").map((t) => t.text);
      if (before.length) { decoy.current.prime(before); setIds(decoy.current.caught()); }
      clock.current = { start: Date.now(), last: 0, done: false };
      TRAPS.get(s.sessionId).clock = clock.current;
      trapStarted();
      let first = null;
      try { first = sessionStorage.getItem("st:trapFirst"); sessionStorage.removeItem("st:trapFirst"); } catch { /* ignore */ }
      if (first) sendText(first);
    }).catch((e) => setErr(e.message));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sessionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "nearest" }); }, [turns]);
  // Save to the trap store as things happen (not in an effect, so a remount can't overwrite it).
  const save = (patch) => { const t = TRAPS.get(s.sessionId); if (t && t.decoy === decoy.current) Object.assign(t, patch); };
  const addTurn = (turn) => setTurns((cur) => { const next = [...cur, turn]; save({ turns: next }); return next; });


  async function sendText(raw) {
    const msg = (raw || "").trim().slice(0, 2000);
    if (!msg || !decoy.current || ended) return;
    setBusy(true); setText("");
    s.send(msg, "other", { quiet: true });             // kept for the complaint report (on the phone until you prepare it)
    const r = decoy.current.reply(msg);
    // a short, human-looking pause before the decoy "types"
    addTurn({ speaker: "other", text: msg });
    await new Promise((res) => setTimeout(res, 400));
    addTurn({ speaker: "persona", text: r.text, why: r.intent });
    clock.current.last = Date.now();
    trapMessage(clock.current.start);
    const caught = decoy.current.caught();
    setIds(caught);
    if (r.caught.length) {
      trapCaptured(r.caught);
      lookupIdentifiers(r.caught).then(({ matches }) => matches.length && setIntel((x) => { const next = [...x, ...matches]; save({ intel: next }); return next; }));
    }
    setBusy(false);
  }

  const stop = () => {
    setEnded(true); save({ ended: true });
    if (clock.current.start && !clock.current.done) { clock.current.done = true; trapEnded(clock.current.start, clock.current.last); }
  };
  const hit = new Map(intel.map((i) => [`${i.kind}:${i.value}`, i]));

  if (!s.sessionId) {
    return (
      <div className="card stack">
        <h1>ScammerTrap</h1>
        <p className="muted">Got a scam message? ScammerTrap replies as a believable decoy, wastes the scammer's time and collects their payment details for your complaint.</p>
        <button className="btn primary big block" onClick={async () => { await s.start("chat"); }}><Icon name="bot" />Start ScammerTrap</button>
      </div>
    );
  }

  return (
    <>
      <div className="banner good"><Icon name="bot" /><div><strong>ScammerTrap is on.</strong> Paste each message the scammer sends. The decoy answers on this phone. Send its reply back with <strong>Copy</strong> or <strong>Share</strong>. It never uses your real details or any numbers.</div></div>
      <div className="card stack">
        <div className="row" role="radiogroup" aria-label="Who the decoy pretends to be">
          <span className="tiny" style={{ flex: "1 0 100%" }}>The decoy is a made-up character, never you. It pretends to be:</span>
          {[["grandmother", "Grandmother"], ["grandfather", "Grandfather"]].map(([id, label]) => (
            <button key={id} type="button" className={`btn ${persona === id ? "primary" : ""}`} aria-pressed={persona === id} onClick={() => setPersona(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="card">
        <h2>Caught details ({ids.length})</h2>
        {ids.length ? (
          <div className="row">
            {ids.map((i) => {
              const h = hit.get(`${i.kind}:${i.value}`);
              return <span key={`${i.kind}:${i.value}`} className={`chip ${h ? "warn" : ""}`}><strong>{i.kind.toUpperCase()}</strong> {i.value}{h ? ` · in ${h.reports} earlier reports${h.includes_demo_data ? " (demo)" : ""}` : ""}</span>;
            })}
          </div>
        ) : <div className="tiny">Nothing yet. The decoy will try to get their UPI ID, account and IFSC, phone number and links.</div>}
      </div>
      <div className="card">
        <h2>Conversation</h2>
        <div className="transcript" aria-live="polite">
          {!turns.length ? <div className="tiny">Paste the scammer's first message below.</div> : null}
          {turns.map((t, i) => (
            <div key={i} className={`bubble ${t.speaker === "persona" ? "persona" : "other"}`}>
              <span className="who">{t.speaker === "persona" ? `Decoy · ${persona === "grandfather" ? "Grandfather" : "Grandmother"} (on this phone)` : "Scammer"}</span>{t.text}
              {t.speaker === "persona" ? (
                <span className="row" style={{ marginTop: 6, gap: 6 }}>
                  <button type="button" className="btn" style={{ minHeight: 34, padding: "4px 10px" }} onClick={async () => { try { await navigator.clipboard.writeText(t.text); setCopied(i); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ } }}>
                    <Icon name="copy" />{copied === i ? "Copied" : "Copy"}</button>
                  {isNative ? <button type="button" className="btn" style={{ minHeight: 34, padding: "4px 10px" }} onClick={() => shareText(t.text, "Reply").catch(() => {})}><Icon name="file" />Share</button> : null}
                </span>
              ) : null}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        {!ended ? (
          <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); sendText(text); }}>
            <input className="input" style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
              placeholder="Paste what the scammer says…" aria-label="Scammer's message" />
            <button className="btn primary" disabled={busy || !text.trim()}>Send</button>
          </form>
        ) : null}
      </div>
      {!ended ? (
        <div className="card stack">
          <button className="btn block" onClick={stop}><Icon name="x" />Stop ScammerTrap</button>
        </div>
      ) : (
        <div className="card stack">
          <div className="banner good"><Icon name="check" />Stopped after {turns.filter((t) => t.speaker === "other").length} scammer messages, with {ids.length} payment detail(s) caught.</div>
          <button className="btn primary block" onClick={() => go("/report")}><Icon name="file" />Create the complaint report (and warn others)</button>
          <button className="btn block" onClick={() => go("/intel")}><Icon name="graph" />See the scam network</button>
        </div>
      )}
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
    </>
  );
}
