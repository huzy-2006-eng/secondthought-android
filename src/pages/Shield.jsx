import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, API_BASE } from "../api.js";
import { isNative, ST } from "../native.js";
import Icon from "../components/Icon.jsx";
import Intervention from "../components/Intervention.jsx";
import { Identifiers, RiskMeter, TacticList, Transcript } from "../components/Risk.jsx";
import { LangContext, useT } from "../i18n.js";
import { useContext } from "react";
import { scamTypeText } from "../tactics_i18n.js";
import { useSession } from "../session.jsx";

const SPEECH_LANGS = [
  { id: "en-IN", label: "English (India)" }, { id: "en-US", label: "English (US)" }, { id: "en-GB", label: "English (UK)" },
  { id: "hi-IN", label: "हिन्दी / Hinglish" }, { id: "es-ES", label: "Español" },
];
const TTS_LANG = { en: "en-IN", "hi-Latn": "hi-IN", hi: "hi-IN", es: "es-ES" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PROGRESS = {}; // playback position per session, survives leaving and returning to this screen

export default function Shield({ go, query }) {
  const t = useT();
  const s = useSession();
  const [scenarios, setScenarios] = useState([]);
  const [scenarioId, setScenarioId] = useState("en_digital_arrest");
  const [overlay, setOverlay] = useState(false);
  const seenLevel = useRef(null);

  useEffect(() => { api.scenarios().then(setScenarios).catch(() => setScenarios([])); }, []);

  // Opened with ?mode=call|chat|demo (from the home screen or the unknown-caller screen).
  const mode = query?.get("mode");
  const wanted = query?.get("scenario");
  useEffect(() => { if (wanted) setScenarioId(wanted); }, [wanted]);
  useEffect(() => {
    if (s.sessionId || !mode) return;
    if (mode === "call" || mode === "chat") s.start(mode).catch((e) => s.setError(e.message));
    else if (mode === "demo" && wanted && scenarios.length) s.start("simulated").catch((e) => s.setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, wanted, scenarios.length]);

  // Open the cooling-off screen when risk crosses the line, and again if it escalates to critical.
  useEffect(() => {
    const snap = s.snap;
    if (!snap) return;
    if (snap.dismissed && !snap.intervene) { seenLevel.current = null; return; } // re-arm after "I know this person"
    if (!snap.intervene) return;
    if (seenLevel.current == null || (seenLevel.current === "high" && snap.level === "critical")) {
      seenLevel.current = snap.level;
      setOverlay(true);
    }
  }, [s.snap]);

  useEffect(() => { if (!s.sessionId) { seenLevel.current = null; setOverlay(false); } }, [s.sessionId]);

  const active = Boolean(s.sessionId);

  return (
    <>
      {!active ? <Start t={t} s={s} scenarios={scenarios} scenarioId={scenarioId} setScenarioId={setScenarioId} /> : null}
      {active && s.channel === "simulated" ? <SimulatedCall s={s} scenario={scenarios.find((x) => x.id === scenarioId)} paused={overlay} /> : null}
      {active && s.channel === "call" ? <ListenMode s={s} t={t} /> : null}
      {active && s.channel === "chat" ? <ChatMode s={s} t={t} /> : null}
      {active ? <LiveView t={t} s={s} go={go} /> : null}
      {!active && !isNative ? <GuardianSetup t={t} s={s} /> : null}
      {overlay && s.snap ? (
        <Intervention snap={s.snap} guardian={s.guardian} ack={s.ack}
          onHangUp={() => { setOverlay(false); go("/report"); }}
          onHandOver={() => { setOverlay(false); go("/honeypot"); }}
          onKnowThem={async () => { setOverlay(false); await s.dismiss(); }}
          onContinue={() => setOverlay(false)} />
      ) : null}
    </>
  );
}

function Start({ t, s, scenarios, scenarioId, setScenarioId }) {
  const [busy, setBusy] = useState(false);
  const begin = async (ch) => {
    setBusy(true);
    try { await s.start(ch); } catch (e) { s.setError(e.message); } finally { setBusy(false); }
  };
  const scams = scenarios.filter((x) => x.label === "scam");
  const genuine = scenarios.filter((x) => x.label !== "scam");
  return (
    <div className="card">
      <h1>{t("protect_title")}</h1>
      <p className="muted">{t("protect_sub")}</p>
      <div className="stack" style={{ marginTop: 14 }}>
        <div>
          <label className="field" htmlFor="scenario">{t("choose_scenario")}</label>
          <select id="scenario" className="input" value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            <optgroup label="Scam calls">{scams.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
            <optgroup label="Genuine calls (should stay calm)">{genuine.map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}</optgroup>
          </select>
        </div>
        <button className="btn primary big block" disabled={busy || !scenarios.length} onClick={() => begin("simulated")}>
          <Icon name="play" />{t("play_sim")}
        </button>
        <div className="grid2">
          <button className="btn" disabled={busy} onClick={() => begin("call")}><Icon name="mic" />{t("listen")}</button>
          <button className="btn" disabled={busy} onClick={() => begin("chat")}><Icon name="chat" />{t("paste_chat")}</button>
        </div>
      </div>
      {s.error ? <div className="banner bad" style={{ marginTop: 12 }}><Icon name="alert" />{s.error}</div> : null}
    </div>
  );
}

function LiveView({ t, s, go }) {
  const snap = s.snap;
  const lang = useContext(LangContext);
  const showWhy = snap && snap.level !== "safe";   // tactic tags stay hidden while risk is low (avoids noisy tags on normal calls)
  return (
    <>
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <RiskMeter snap={snap} />
          {!s.connected ? <span className="pill" title="Reconnecting to the server">offline</span> : null}
        </div>
        <p style={{ marginTop: 10, fontWeight: 600 }} aria-live="polite">{snap?.explanation || "Listening for manipulation tactics…"}</p>
        {snap?.scam_type ? <p className="muted">{scamTypeText(lang, snap.scam_type)}</p> : null}
        {snap?.dismissed ? <div className="banner info"><Icon name="info" />You said you know this person. We'll only warn you again if the risk clearly rises.</div> : null}
        {s.guardian ? (
          <div className="tiny">
            <Icon name="users" style={{ width: 14, height: 14, verticalAlign: "-2px" }} />{" "}
            {s.ack || (snap?.guardian_alerted ? t("guardian_alerted", { name: s.guardian.guardian_name }) : t("guardian_linked_to", { name: s.guardian.guardian_name }))}
          </div>
        ) : null}
      </div>

      {showWhy && snap.tactics?.length ? (
        <div className="card"><h2>{t("why")}</h2><TacticList tactics={snap.tactics} /></div>
      ) : null}

      {snap?.entities?.some((e) => e.shareable) ? (
        <div className="card"><h2>{t("details_given")}</h2><Identifiers entities={snap.entities.filter((e) => e.speaker !== "user")} intel={snap.intel} /></div>
      ) : null}

      <div className="card">
        <h2>{t("conversation")}</h2>
        <Transcript turns={s.turns} snap={snap} />
      </div>

      <div className="card stack">
        <button className="btn block" onClick={() => go("/pay")}><Icon name="card" />{t("make_payment")}</button>
        <button className="btn block" onClick={() => go("/honeypot")}><Icon name="bot" />{t("hand_over")}</button>
        <div className="grid2">
          <button className="btn" onClick={() => s.dismiss()}>{t("i_know")}</button>
          <button className="btn" onClick={() => go("/report")}><Icon name="file" />{t("end_report")}</button>
        </div>
        <button className="btn ghost block" onClick={() => s.reset(true)}><Icon name="x" />{t("end")} (forget this conversation)</button>
      </div>
    </>
  );
}

// ------------------------------------------------------------- simulated call
function SimulatedCall({ s, scenario, paused }) {
  const [idx, setIdx] = useState(() => PROGRESS[s.sessionId] || 0);
  const [running, setRunning] = useState(true);
  const [speak, setSpeak] = useState(false);
  const [speed, setSpeed] = useState(1);
  const pausedRef = useRef(false);
  pausedRef.current = paused || !running;
  const stateRef = useRef({ speak, speed });
  stateRef.current = { speak, speed };

  const say = useCallback((text, lang) => new Promise((resolve) => {
    if (!stateRef.current.speak || !("speechSynthesis" in window)) return resolve();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = TTS_LANG[lang] || "en-IN";
    u.rate = Math.min(1.4, 0.95 * stateRef.current.speed);
    u.onend = resolve; u.onerror = resolve;
    window.speechSynthesis.speak(u);
  }), []);

  useEffect(() => {
    if (!scenario) return;
    let cancelled = false;
    (async () => {
      for (let i = PROGRESS[s.sessionId] || 0; i < scenario.turns.length && !cancelled; i++) {
        while (pausedRef.current && !cancelled) await sleep(200);
        if (cancelled) break;
        const turn = scenario.turns[i];
        PROGRESS[s.sessionId] = i + 1;
        await s.send(turn.text, turn.speaker);
        setIdx(i + 1);
        await say(turn.text, scenario.lang);
        await sleep((1200 + turn.text.length * 28) / stateRef.current.speed);
      }
    })();
    return () => { cancelled = true; try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario?.id, s.sessionId]);

  if (!scenario) return null;
  const done = idx >= scenario.turns.length;
  return (
    <div className="banner info" style={{ alignItems: "center" }}>
      <Icon name="play" />
      <div style={{ flex: 1 }}>
        <strong>Simulated call:</strong> {scenario.title}
        <div className="tiny">Turn {idx} of {scenario.turns.length}{done ? " · finished" : paused ? " · paused for the warning" : ""}</div>
      </div>
      <div className="row">
        {!done ? <button className="btn" onClick={() => setRunning((r) => !r)} aria-label={running ? "Pause" : "Resume"}>{running ? "Pause" : "Resume"}</button> : null}
        <button className={`btn ${speak ? "primary" : ""}`} onClick={() => setSpeak((v) => !v)} aria-pressed={speak} title="Read the caller's lines aloud">
          <Icon name="volume" /><span className="visually-hidden">Read aloud</span>
        </button>
        <select className="input" style={{ width: 76 }} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Speed">
          <option value={0.6}>0.6×</option><option value={1}>1×</option><option value={2}>2×</option>
        </select>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- speakerphone
function ListenMode({ s, t }) {
  if (isNative) return <NativeListenMode s={s} t={t} />;
  return <BrowserListenMode s={s} t={t} />;
}

function Consent({ t, audioKey, onStart }) {
  const [agree, setAgree] = useState(false);
  return (
    <div className="card stack" role="region" aria-labelledby="consent-title">
      <h2 id="consent-title"><Icon name="shield" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("consent_title")}</h2>
      <ul style={{ margin: 0, paddingLeft: 18 }} className="stack">
        <li>{t(audioKey)}</li>
        <li>{t("consent_text")}</li>
        <li>{t("consent_guardian")}</li>
        <li><strong>{t("consent_other")}</strong></li>
      </ul>
      <label className="row" style={{ alignItems: "flex-start" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 24, height: 24, marginTop: 2 }} />
        {t("consent_agree")}
      </label>
      <button className="btn primary big block" disabled={!agree} onClick={onStart}><Icon name="mic" />{t("consent_start")}</button>
    </div>
  );
}

// Android: the phone's own SpeechRecognizer (the WebView has no Web Speech API).
// Meant for a second phone or tablet next to a call on speaker: Android gives apps silence
// instead of call audio on the phone that is in the call.
function NativeListenMode({ s, t }) {
  const [lang, setLang] = useState("en-IN");
  const [consented, setConsented] = useState(false);
  const [listening, setListening] = useState(false);
  const [onDevice, setOnDevice] = useState(false);
  const [speaker, setSpeaker] = useState("other");
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState(null);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  useEffect(() => {
    const subs = [
      ST.addListener("speech", (e) => {
        if (e.final) { setInterim(""); s.send(e.text, speakerRef.current); } else setInterim(e.text);
      }),
      ST.addListener("speechState", (e) => {
        setListening(Boolean(e.listening)); setOnDevice(Boolean(e.onDevice));
        if (e.error) setErr(e.error);
      }),
    ];
    return () => { subs.forEach((p) => p.then((h) => h.remove()).catch(() => {})); ST.stopListening().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.sessionId]);

  const start = async () => {
    setErr(null);
    try { const r = await ST.startListening({ lang }); setListening(true); setOnDevice(Boolean(r.onDevice)); }
    catch (e) { setErr(e.message); setListening(false); }
  };
  const stop = async () => { try { await ST.stopListening(); } catch { /* ignore */ } setListening(false); };

  if (!consented) return <Consent t={t} audioKey="consent_audio_app" onStart={() => { setConsented(true); start(); }} />;
  return (
    <div className="card stack">
      <div className="row">
        <select className="input" style={{ flex: 1 }} value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening} aria-label="Speech language">
          {SPEECH_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        {listening
          ? <button className="btn danger" onClick={stop}><Icon name="mic" />{t("stop")}</button>
          : <button className="btn primary" onClick={start}><Icon name="mic" />{t("consent_start")}</button>}
      </div>
      <div className="row" role="radiogroup" aria-label="Who is speaking">
        <span className="tiny">Who is speaking now:</span>
        <button className={`btn ${speaker === "other" ? "primary" : ""}`} aria-pressed={speaker === "other"} onClick={() => setSpeaker("other")}>Caller</button>
        <button className={`btn ${speaker === "user" ? "primary" : ""}`} aria-pressed={speaker === "user"} onClick={() => setSpeaker("user")}>Me</button>
      </div>
      {listening ? <div className="tiny"><span className="pulse" style={{ display: "inline-block", marginRight: 6 }} />Listening{onDevice ? " (on this phone)" : ""}. {interim ? <em>“{interim}”</em> : null}</div> : null}
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      <div className="tiny">{t("inc_same_phone")}</div>
    </div>
  );
}

function BrowserListenMode({ s, t }) {
  const Rec = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const [lang, setLang] = useState("en-IN");
  const [listening, setListening] = useState(false);
  const [speaker, setSpeaker] = useState("other");
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState(null);
  const [consented, setConsented] = useState(false);
  const [agree, setAgree] = useState(false);
  const recRef = useRef(null);
  const want = useRef(false);
  const speakerRef = useRef(speaker);
  speakerRef.current = speaker;

  const start = useCallback(() => {
    if (!Rec) return;
    setErr(null);
    const rec = new Rec();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) s.send(r[0].transcript, speakerRef.current);
        else partial += r[0].transcript;
      }
      setInterim(partial);
    };
    rec.onerror = (e) => { if (e.error === "not-allowed" || e.error === "service-not-allowed") { want.current = false; setErr("Microphone permission was denied."); } };
    rec.onend = () => { setInterim(""); if (want.current) { try { rec.start(); } catch { /* restarting */ } } else setListening(false); };
    recRef.current = rec;
    want.current = true;
    try { rec.start(); setListening(true); } catch (e) { setErr(e.message); }
  }, [Rec, lang, s]);

  const stop = () => { want.current = false; try { recRef.current?.stop(); } catch { /* ignore */ } setListening(false); };
  useEffect(() => () => { want.current = false; try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  if (!consented) {
    return (
      <div className="card stack" role="region" aria-labelledby="consent-title">
        <h2 id="consent-title"><Icon name="shield" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("consent_title")}</h2>
        <ul style={{ margin: 0, paddingLeft: 18 }} className="stack">
          <li>{t("consent_audio")}</li>
          <li>{t("consent_text")}</li>
          <li>{t("consent_guardian")}</li>
          <li><strong>{t("consent_other")}</strong></li>
        </ul>
        <label className="row" style={{ alignItems: "flex-start" }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ width: 20, height: 20, marginTop: 2 }} />
          {t("consent_agree")}
        </label>
        <button className="btn primary block" disabled={!agree} onClick={() => setConsented(true)}><Icon name="mic" />{t("consent_start")}</button>
      </div>
    );
  }
  if (!Rec) {
    return (
      <div className="banner warn"><Icon name="alert" />
        <div>Live speech recognition isn't available in this browser. Use Chrome on Android or desktop, or switch to chat mode.
          <ChatMode s={s} t={t} embedded />
        </div>
      </div>
    );
  }
  return (
    <div className="card stack">
      <div className="row">
        <select className="input" style={{ flex: 1 }} value={lang} onChange={(e) => setLang(e.target.value)} disabled={listening} aria-label="Speech language">
          {SPEECH_LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
        {listening
          ? <button className="btn danger" onClick={stop}><Icon name="mic" />Stop listening</button>
          : <button className="btn primary" onClick={start}><Icon name="mic" />Start listening</button>}
      </div>
      <div className="row" role="radiogroup" aria-label="Who is speaking">
        <span className="tiny">Who is speaking now:</span>
        <button className={`btn ${speaker === "other" ? "primary" : ""}`} aria-pressed={speaker === "other"} onClick={() => setSpeaker("other")}>Caller</button>
        <button className={`btn ${speaker === "user" ? "primary" : ""}`} aria-pressed={speaker === "user"} onClick={() => setSpeaker("user")}>Me</button>
      </div>
      {listening ? <div className="tiny"><span className="pulse" style={{ display: "inline-block", marginRight: 6 }} />Listening. Put the call on speaker. {interim ? <em>“{interim}”</em> : null}</div> : null}
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      <div className="tiny">{t("consent_audio")}</div>
    </div>
  );
}

// ------------------------------------------------------------- chat
function ChatMode({ s, t, embedded }) {
  const [text, setText] = useState("");
  const submit = (speaker) => { if (text.trim()) { s.send(text, speaker); setText(""); } };
  const body = (
    <div className="stack">
      <textarea className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste or type a message from the conversation…"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit("other"); }} aria-label="Message" />
      <div className="grid2">
        <button className="btn primary" onClick={() => submit("other")}>{t("they_said")}</button>
        <button className="btn" onClick={() => submit("user")}>{t("i_said")}</button>
      </div>
    </div>
  );
  return embedded ? <div style={{ marginTop: 10 }}>{body}</div> : <div className="card">{body}<div className="tiny" style={{ marginTop: 8 }}>{t("chat_privacy")}</div></div>;
}

// ------------------------------------------------------------- guardian pairing
export function GuardianSetup({ t, s }) {
  const [protectedName, setProtectedName] = useState("Mum");
  const [guardianName, setGuardianName] = useState("Riya");
  const [qr, setQr] = useState(null);
  const [err, setErr] = useState(null);
  const link = s.guardian ? `${API_BASE || location.origin}/#/guardian/${s.guardian.code}` : null;

  useEffect(() => {
    if (!link) { setQr(null); return; }
    QRCode.toDataURL(link, { margin: 1, width: 300 }).then(setQr).catch(() => setQr(null));
  }, [link]);

  const pair = async () => {
    setErr(null);
    try {
      const g = await api.pair(protectedName, guardianName);
      s.setGuardian(g);
    } catch (e) { setErr(e.message); }
  };

  if (s.guardian) {
    return (
      <div className="card">
        <h2><Icon name="users" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("guardian_linked_to", { name: s.guardian.guardian_name })}</h2>
        <p className="muted">{s.guardian.guardian_name} gets an alert on their phone when a call protecting {s.guardian.protected_name} looks like a scam. They see the warning, never the conversation.</p>
        <div className="row" style={{ alignItems: "flex-start" }}>
          {qr ? <img className="qr" src={qr} alt={`QR code that opens the guardian screen for code ${s.guardian.code}`} /> : null}
          <div className="stack">
            <div><div className="tiny">Pairing code</div><div className="code-big">{s.guardian.code}</div></div>
            <div className="tiny">Scan with the family member's phone, or open <a href={link}>{link}</a></div>
            <button className="btn ghost" onClick={() => s.setGuardian(null)}>Unlink</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="card stack">
      <h2>{t("link_guardian")}</h2>
      <p className="muted">A trusted person is alerted the moment a call turns dangerous, so they can call and check on you.</p>
      <div className="grid2">
        <div><label className="field" htmlFor="pn">Who is protected</label><input id="pn" className="input" value={protectedName} maxLength={40} onChange={(e) => setProtectedName(e.target.value)} /></div>
        <div><label className="field" htmlFor="gn">Who gets alerts</label><input id="gn" className="input" value={guardianName} maxLength={40} onChange={(e) => setGuardianName(e.target.value)} /></div>
      </div>
      <button className="btn" onClick={pair}><Icon name="users" />{t("link_guardian")}</button>
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
    </div>
  );
}
