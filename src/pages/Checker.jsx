import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { getEngine } from "../engine/browser.js";
import { senderFromScreenshot } from "../engine/sender.js";
import { lookupIdentifiers } from "../localchecks.js";
import { useSession } from "../session.jsx";
import { useT } from "../i18n.js";
import { DotScanner } from "../components/Brand.jsx";
import { recordCheck } from "../checkstats.js";
import { openExternal, CHAKSHU_URL, isNative, ST } from "../native.js";
import Icon from "../components/Icon.jsx";

// Two sender demos: the SAME polite message, once from HDFC's real sender ID and once from a mobile number.
const POLITE = "Dear Customer, your HDFC Bank relationship manager has changed. Please save this number for all future banking help.";
const SENDER_EXAMPLES = [
  { text: POLITE, sender: "VM-HDFCBK-S", label: "Bank SMS from VM-HDFCBK-S" },
  { text: POLITE, sender: "+91 98201 44517", label: "Same SMS from +91 98201 44517" },
  { text: "Dear SBI user, your YONO account will be blocked today. Update PAN now.", sender: "VM-SBIINB1", label: "From lookalike VM-SBIINB1" },
];
export const TRAI_HEADER_URL = "https://smsheader.trai.gov.in/";
const EXAMPLES = [
  "Your SBI YONO account will be blocked today. Update your PAN now: sbi-yono-kyc.example.com",
  "Pay the activation fee to demo.taskpay@ybl to unlock your withdrawal",
  "Hi Mum, I dropped my phone, this is my new number. Can you help me pay a bill today?",
  "https://paypa1-login.example.com/signin",
  "Your Amazon order has shipped and will arrive Thursday.",
];
const VERDICT = {
  scam: { cls: "bad", icon: "octagon", title: "Scam" },
  suspicious: { cls: "warn", icon: "alert", title: "Suspicious" },
  "looks safe": { cls: "good", icon: "check", title: "Looks safe" },
};

export default function Checker({ initialText, initialImage, initialSender, go }) {
  const [text, setText] = useState(initialText || "");
  const [sender, setSender] = useState(initialSender || "");
  const [inbox, setInbox] = useState(null);
  // The message box grows with the text (up to ~8 lines) so the start of a long SMS isn't hidden.
  const box = useRef(null);
  useEffect(() => { const el = box.current; if (!el) return; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 230) + "px"; }, [text]);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [note, setNote] = useState(null);
  const s = useSession();
  const t = useT();

  const [reading, setReading] = useState(false);
  const [fromImage, setFromImage] = useState(false);
  // Screenshot text is read ON THE PHONE (ML Kit, bundled models), then checked by the on-device engine.
  const useImageText = (r) => {
    if (r?.cancelled) return;
    let txt = (r?.text || "").trim();
    if (!txt) { setErr(t("scan_no_text")); return; }
    // The sender line at the top of an SMS screenshot ("VM-SBIINB", "+91 98...") becomes the sender.
    const found = senderFromScreenshot(txt);
    let snd = sender;
    if (found && found.text) { txt = found.text; snd = found.sender; setSender(snd); }
    setText(txt); setFromImage(true); run(txt, snd);
  };
  const scanScreenshot = async () => {
    setErr(null); setReading(true);
    try { useImageText(await ST.scanImage()); } catch (e) { setErr(e.message); } finally { setReading(false); }
  };
  useEffect(() => {
    if (!initialImage || !isNative) return;
    setReading(true);
    ST.readSharedImage({ uri: initialImage }).then(useImageText).catch((e) => setErr(e.message)).finally(() => setReading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImage]);

  const trapIt = async () => {
    try { sessionStorage.setItem("st:trapFirst", text.trim()); } catch { /* ignore */ }
    await s.reset(); await s.start("chat"); go("/honeypot");
  };
  const chakshu = async () => {
    const ids = (res?.entities || []).filter((e) => e.shareable).map((e) => `${e.kind.toUpperCase()}: ${e.value}`);
    const details = ["Suspected fraud message (checked with SecondThought: " + res.verdict + ", risk " + res.score + "/100)",
      "Received: " + new Date().toLocaleString(), ids.length ? "Details in the message: " + ids.join(", ") : "", "Message:", text.trim()].filter(Boolean).join("\n");
    try { await navigator.clipboard.writeText(details); } catch { /* ignore */ }
    setNote(t("chakshu_copied"));
    openExternal(CHAKSHU_URL);
  };

  const run = async (value = text, from = sender) => {
    const v = value.trim();
    if (!v) return;
    setBusy(true); setErr(null);
    try {
      // Checked inside the app by the same rules and trained models as the server: the text never leaves the phone.
      const engine = await getEngine();
      const t0 = performance.now();
      const r = engine.checkWithSender(v, from);
      r.ms = Math.max(1, Math.round(performance.now() - t0));
      recordCheck(r.verdict);
      setRes(r);
      // Only identifiers (UPI IDs, numbers, links) are looked up in the scam-report network, when online.
      lookupIdentifiers(r.entities).then(({ online, matches }) => setRes((cur) => (cur === r ? { ...r, intel: matches, online } : cur)));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Text shared from another app ("Share → SecondThought") is checked straight away.
  useEffect(() => {
    if (initialText) { setText(initialText); setSender(initialSender || ""); run(initialText, initialSender || ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialText]);

  const onQrFile = async (file) => {
    setErr(null);
    try {
      const img = await createImageBitmap(file);
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const code = jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height);
      if (!code) { setErr("No QR code found in that image."); return; }
      setText(code.data); run(code.data);
    } catch { setErr("Couldn't read that image."); }
  };

  // Pick a message from the SMS inbox: the sender comes with it (sharing an SMS only shares its text).
  const openInbox = async () => {
    setErr(null);
    try {
      let r = await ST.recentSms({ limit: 40 }).catch((e) => e);
      if (r instanceof Error || r?.denied) { const p = await ST.requestSms(); if (!p.read) { setErr(t("inbox_denied")); return; } r = await ST.recentSms({ limit: 40 }); }
      setInbox(r.messages || []);
    } catch (e) { setErr(e.message || t("inbox_denied")); }
  };
  const pickSms = (m) => { setInbox(null); setText(m.body); setSender(m.address); setFromImage(false); run(m.body, m.address); };

  const v = res ? VERDICT[res.verdict] : null;
  return (
    <>
      <div className="card stack">
        <h1 style={{ marginBottom: 0 }}>{t("check_title")}</h1>
        <DotScanner busy={busy || reading}><Icon name="shield" /></DotScanner>
        <div><div style={{ fontWeight: 700, fontSize: "1.1rem" }}>{t("check_label")}</div><div className="tiny">{t("check_sub")}</div></div>
        <div className="pillinput"><Icon name="search" />
          <textarea ref={box} value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="www.example.com, or paste the message…" aria-label="Message to check" /></div>
        <div className="senderfield">
          <label htmlFor="st-sender" className="tiny">{t("sender_label")}</label>
          <div className="pillinput sender"><Icon name="user" />
            <input id="st-sender" value={sender} maxLength={40} onChange={(e) => setSender(e.target.value)} placeholder={t("sender_ph")} title={t("sender_hint")} autoCapitalize="characters" spellCheck={false} /></div>
        </div>
        <button className="btn primary big block" disabled={busy || !text.trim()} onClick={() => run()}><Icon name="search" />{busy ? "Checking…" : "Check it"}</button>
        {isNative ? <button className="btn big block" onClick={openInbox}><Icon name="inbox" />{t("inbox_pick")}</button> : null}
        {inbox ? <InboxSheet list={inbox} onPick={pickSms} onClose={() => setInbox(null)} t={t} /> : null}
        {isNative ? (
          <button className="btn big block" onClick={scanScreenshot} disabled={reading}><Icon name="camera" />{reading ? t("scan_reading") : t("scan_screenshot")}</button>
        ) : null}
        {fromImage ? <div className="tiny">{t("scan_note")}</div> : null}
        <div className="grid2">
          <label className="btn" style={{ cursor: "pointer" }}><Icon name="qr" />QR from image
            <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && onQrFile(e.target.files[0])} /></label>
          <button className="btn" onClick={() => setScanning((x) => !x)}><Icon name="camera" />{scanning ? "Stop camera" : "Scan with camera"}</button>
        </div>
        {scanning ? <CameraScan onCode={(d) => { setScanning(false); setText(d); run(d); }} onError={(m) => { setScanning(false); setErr(m); }} /> : null}
        <div>
          <div className="tiny" style={{ marginBottom: 6 }}>Try an example:</div>
          <div className="row">{SENDER_EXAMPLES.map((e) => <button key={e.label} className="chip senderchip" style={{ border: 0, cursor: "pointer", textAlign: "left" }} onClick={() => { setText(e.text); setSender(e.sender); run(e.text, e.sender); }}><Icon name="user" style={{ width: 13, height: 13, verticalAlign: "-2px" }} /> {e.label}</button>)}
            {EXAMPLES.map((e) => <button key={e} className="chip" style={{ border: 0, cursor: "pointer", textAlign: "left" }} onClick={() => { setText(e); setSender(""); run(e, ""); }}>{e.length > 46 ? e.slice(0, 44) + "…" : e}</button>)}</div>
        </div>
        {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      </div>

      {res && v ? (
        <div className="card stack" aria-live="polite">
          <div className="resultcard"><h3><Icon name={v.icon} className="warnicon" style={{ color: v.cls === "bad" ? "var(--critical)" : v.cls === "warn" ? "var(--warning)" : "var(--good)" }} />{res.verdict === "scam" ? t("res_scam") : res.verdict === "suspicious" ? t("res_warning") : t("res_safe")}</h3>
            <div className="tiny" style={{ marginTop: 4 }}>{v.title} · risk {res.score}/100{res.scam_type ? ` · ${res.scam_type}` : ""}</div></div>
          <div className="tiny"><Icon name="shield" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> Checked on this phone in {res.ms} ms. The message was not uploaded.{res.online === false ? " (Offline: scam-report lookup skipped.)" : ""}</div>
          {res.sender ? <SenderCard sc={res.sender} t={t} /> : null}
          {res.intel?.length ? (
            <div className="banner bad"><Icon name="alert" /><div>{res.intel.map((h) => <div key={h.kind + h.value}><strong>{h.value}</strong> appears in {h.reports} scam report(s) from {h.reporters} people{h.includes_demo_data ? " (includes demo data)" : ""}.</div>)}</div></div>
          ) : null}
          {res.reasons.filter((r) => r.kind !== "sender").length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>{res.reasons.filter((r) => r.kind !== "sender").map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r.text}{r.advice ? <div className="tiny">{r.advice}</div> : null}</li>)}</ul>
          ) : <p className="muted">No warning signs found. Still, never share codes or PINs with anyone.</p>}
          {res.verdict !== "looks safe" ? (
            <div className="stack">
              <button className="btn primary big block" onClick={trapIt}><Icon name="bot" />{t("trap_reply")}</button>
              <button className="btn big block" onClick={chakshu}><Icon name="file" />{t("report_chakshu")}</button>
            </div>
          ) : null}
          {note ? <div className="banner info"><Icon name="info" />{note}</div> : null}
          <div className="scorebars" role="list" aria-label="How each check scored">
            {[["Manipulation tactics", "rules + trained model", res.parts.tactics], ["Message model", "trained on real scam SMS", res.parts.message_model], ["Links", "phishing model + blocklist", res.parts.links],
              ...(res.parts.sender != null ? [["Sender ID", "TRAI DLT header check", res.parts.sender]] : [])].map(([name, sub, v]) => (
              <div key={name} className="scorebar" role="listitem">
                <div className="sb-head"><span><strong>{name}</strong> <small>{sub}</small></span><b className={v >= 60 ? "hi" : v >= 35 ? "mid" : "lo"}>{v}</b></div>
                <div className="sb-track"><i className={v >= 60 ? "hi" : v >= 35 ? "mid" : "lo"} style={{ width: `${Math.max(3, v)}%` }} /></div>
              </div>
            ))}
          </div>
          {res.links.length ? (
            <div><h3>Links</h3>{res.links.map((l) => (
              <div key={l.url} className="row" style={{ justifyContent: "space-between", borderBottom: "1px solid var(--border)", padding: "6px 0" }}>
                <span style={{ overflowWrap: "anywhere" }}>{l.url}</span><span className="chip">{l.verdict} · {Math.round(l.probability * 100)}%</span>
              </div>))}</div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

const LEVEL = { bad: ["bad", "octagon", "var(--critical)"], warn: ["warn", "alert", "var(--warning)"], good: ["good", "check", "var(--good)"], info: ["info", "info", "var(--accent)"] };
export function SenderCard({ sc, t }) {
  const [cls, icon, color] = LEVEL[sc.level];
  const s = sc.sender;
  return (
    <div className={`sendercard ${cls}`} role="group" aria-label={t("sender_card")}>
      <div className="sc-head"><Icon name={icon} style={{ color }} /><div><div className="tiny" style={{ textTransform: "uppercase", letterSpacing: ".06em" }}>{t("sender_card")}</div><strong>{sc.title}</strong></div></div>
      {s.type === "header" ? (
        <div className="sc-parts">
          {s.prefix ? <span><small>{t("sender_parts_op")}</small><b>{s.prefix}</b></span> : null}
          <span className="hdr"><small>{t("sender_parts_hdr")}</small><b>{s.header}</b></span>
          {s.category ? <span><small>{t("sender_parts_cat")}</small><b>{s.category} · {t("cat_" + s.category)}</b></span> : null}
        </div>
      ) : <div className="sc-parts"><span className="hdr"><small>{t("sender_from")}</small><b>{s.value}</b></span></div>}
      <p className="tiny" style={{ margin: 0 }}>{sc.detail}</p>
      {sc.cleared ? <p className="tiny" style={{ margin: 0 }}>{t(sc.code === "known" ? "sender_cleared" : "sender_cleared_reg", { n: sc.cleared })}</p> : null}
      {s.type === "header" && sc.level !== "good" ? <button className="btn" onClick={() => openExternal(TRAI_HEADER_URL)}><Icon name="external" />{t("sender_trai")}</button> : null}
    </div>
  );
}

function InboxSheet({ list, onPick, onClose, t }) {
  return (
    <div className="inboxsheet" role="dialog" aria-label={t("inbox_title")}>
      <div className="row" style={{ justifyContent: "space-between" }}><h3 style={{ margin: 0 }}>{t("inbox_title")}</h3><button className="btn" onClick={onClose}>{t("inbox_close")}</button></div>
      {list.length ? list.map((m, i) => (
        <button key={i} className="inboxrow" onClick={() => onPick(m)}>
          <span className="who">{m.address}</span><span className="when">{new Date(m.date).toLocaleString([], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          <span className="body">{m.body.length > 110 ? m.body.slice(0, 108) + "…" : m.body}</span>
        </button>
      )) : <p className="muted">{t("inbox_empty")}</p>}
    </div>
  );
}

export function CameraScan({ onCode, onError }) {
  const video = useRef(null);
  const cb = useRef({ onCode, onError });
  cb.current = { onCode, onError };
  useEffect(() => {
    let stream, raf, stopped = false;
    const canvas = document.createElement("canvas");
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        video.current.srcObject = stream;
        await video.current.play();
        const tick = () => {
          if (stopped) return;
          const v = video.current;
          if (v && v.videoWidth) {
            canvas.width = v.videoWidth; canvas.height = v.videoHeight;
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            ctx.drawImage(v, 0, 0);
            const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
            if (code?.data) { cb.current.onCode(code.data); return; }
          }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch { cb.current.onError("Camera not available. Use 'QR from image' instead."); }
    })();
    return () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  }, []);
  return <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#000" }} aria-label="Camera preview" />;
}
