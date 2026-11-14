import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { getEngine } from "../engine/browser.js";
import { lookupIdentifiers } from "../localchecks.js";
import { useSession } from "../session.jsx";
import { useT } from "../i18n.js";
import { openExternal, CHAKSHU_URL, isNative, ST } from "../native.js";
import Icon from "../components/Icon.jsx";

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

export default function Checker({ initialText, initialImage, go }) {
  const [text, setText] = useState(initialText || "");
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
    const txt = (r?.text || "").trim();
    if (!txt) { setErr(t("scan_no_text")); return; }
    setText(txt); setFromImage(true); run(txt);
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

  const run = async (value = text) => {
    const v = value.trim();
    if (!v) return;
    setBusy(true); setErr(null);
    try {
      // Checked inside the app by the same rules and trained models as the server: the text never leaves the phone.
      const engine = await getEngine();
      const t0 = performance.now();
      const r = engine.check(v);
      r.ms = Math.max(1, Math.round(performance.now() - t0));
      setRes(r);
      // Only identifiers (UPI IDs, numbers, links) are looked up in the scam-report network, when online.
      lookupIdentifiers(r.entities).then(({ online, matches }) => setRes((cur) => (cur === r ? { ...r, intel: matches, online } : cur)));
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  // Text shared from another app ("Share → SecondThought") is checked straight away.
  useEffect(() => {
    if (initialText) { setText(initialText); run(initialText); }
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

  const v = res ? VERDICT[res.verdict] : null;
  return (
    <>
      <div className="card stack">
        <h1>Check a message, link or QR code</h1>
        <p className="muted">Paste anything suspicious: an SMS, a WhatsApp message, an email, a link. Or scan the QR code someone sent you.</p>
        <textarea className="input" value={text} maxLength={5000} onChange={(e) => setText(e.target.value)} placeholder="Paste the message or link here…" aria-label="Message to check" />
        <button className="btn primary big block" disabled={busy || !text.trim()} onClick={() => run()}><Icon name="search" />{busy ? "Checking…" : "Check it"}</button>
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
          <div className="row">{EXAMPLES.map((e) => <button key={e} className="chip" style={{ border: 0, cursor: "pointer", textAlign: "left" }} onClick={() => { setText(e); run(e); }}>{e.length > 46 ? e.slice(0, 44) + "…" : e}</button>)}</div>
        </div>
        {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      </div>

      {res && v ? (
        <div className="card stack" aria-live="polite">
          <div className={`banner ${v.cls}`} style={{ fontSize: "1.1rem" }}><Icon name={v.icon} /><div><strong>{v.title}</strong> · risk {res.score}/100{res.scam_type ? ` · ${res.scam_type}` : ""}</div></div>
          <div className="tiny"><Icon name="shield" style={{ width: 14, height: 14, verticalAlign: "-2px" }} /> Checked on this phone in {res.ms} ms. The message was not uploaded.{res.online === false ? " (Offline: scam-report lookup skipped.)" : ""}</div>
          {res.intel?.length ? (
            <div className="banner bad"><Icon name="alert" /><div>{res.intel.map((h) => <div key={h.kind + h.value}><strong>{h.value}</strong> appears in {h.reports} scam report(s) from {h.reporters} people{h.includes_demo_data ? " (includes demo data)" : ""}.</div>)}</div></div>
          ) : null}
          {res.reasons.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>{res.reasons.map((r, i) => <li key={i} style={{ marginBottom: 6 }}>{r.text}{r.advice ? <div className="tiny">{r.advice}</div> : null}</li>)}</ul>
          ) : <p className="muted">No warning signs found. Still, never share codes or PINs with anyone.</p>}
          {res.verdict !== "looks safe" ? (
            <div className="grid2">
              <button className="btn primary" onClick={trapIt}><Icon name="bot" />{t("trap_reply")}</button>
              <button className="btn" onClick={chakshu}><Icon name="file" />{t("report_chakshu")}</button>
            </div>
          ) : null}
          {note ? <div className="banner info"><Icon name="info" />{note}</div> : null}
          <table>
            <caption className="visually-hidden">How each check scored</caption>
            <thead><tr><th>Check</th><th className="num">Risk</th></tr></thead>
            <tbody>
              <tr><td>Manipulation tactics (rules + trained model)</td><td className="num">{res.parts.tactics}</td></tr>
              <tr><td>Message model (trained on real scam/spam SMS)</td><td className="num">{res.parts.message_model}</td></tr>
              <tr><td>Links (phishing URL model + blocklist)</td><td className="num">{res.parts.links}</td></tr>
            </tbody>
          </table>
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
