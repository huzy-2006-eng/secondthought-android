import { useState } from "react";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { isNative, shareText } from "../native.js";
import { useSession } from "../session.jsx";

const REGIONS = [["IN", "India"], ["US", "United States"], ["UK", "United Kingdom"], ["ES", "España"], ["OTHER", "Other country"]];

export default function Report({ go }) {
  const s = useSession();
  const [region, setRegion] = useState(s.region || "IN");
  const [lost, setLost] = useState("");
  const [share, setShare] = useState(true);
  const [rep, setRep] = useState(null);
  const [err, setErr] = useState(null);
  const [copied, setCopied] = useState(false);

  if (!s.sessionId) {
    return (
      <div className="card stack">
        <h1>Report a scam</h1>
        <p className="muted">Reports are built from a protected call or chat. Start one on the Shield screen.</p>
        <button className="btn primary" onClick={() => go("/")}>Go to Shield</button>
      </div>
    );
  }

  const generate = async () => {
    setErr(null);
    s.setRegion(region);
    try { setRep(await api.report(await s.ensureServer(), { region, money_lost: lost || null, share_with_network: share })); } catch (e) { setErr(`Preparing the complaint needs the internet (${e.message}).`); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(rep.text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { setErr("Copy failed; select the text and copy it manually."); }
  };
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rep.text], { type: "text/plain" }));
    a.download = "scam-report.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <div className="card stack">
        <h1>Report this scam</h1>
        <p className="muted">We prepare the complaint; you file it with the official service. Your own codes and card numbers are removed.</p>
        <div className="grid2">
          <div><label className="field" htmlFor="region">Country</label>
            <select id="region" className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select></div>
          <div><label className="field" htmlFor="lost">Money lost (if any)</label>
            <input id="lost" className="input" value={lost} maxLength={60} onChange={(e) => setLost(e.target.value)} placeholder="none" /></div>
        </div>
        <label className="row"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} style={{ width: 20, height: 20 }} />
          Also add the scammer's details (never yours) to the shared network</label>
        <button className="btn primary block" onClick={generate}><Icon name="file" />Prepare my complaint</button>
        {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      </div>
      {rep ? (
        <div className="card stack">
          {rep.shared ? <div className="banner good"><Icon name="check" />{rep.shared.identifiers} scammer detail(s) shared with the network.</div> : null}
          <h2>File it here</h2>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>{linkify(rep.file_with.where)}</li><li>{rep.file_with.phone}</li><li>{rep.file_with.bank}</li>
          </ul>
          <div className="row">
            <button className="btn" onClick={copy}><Icon name="copy" />{copied ? "Copied" : "Copy text"}</button>
            {isNative
              ? <button className="btn" onClick={() => shareText(rep.text, "Scam report").catch((e) => setErr(e.message))}><Icon name="file" />Share</button>
              : <button className="btn" onClick={download}><Icon name="file" />Download</button>}
          </div>
          <pre className="report">{rep.text}</pre>
          <div className="tiny">{rep.note}</div>
          <button className="btn ghost block" onClick={async () => { await s.reset(true); go("/"); }}>Finish and forget this conversation</button>
        </div>
      ) : null}
    </>
  );
}

function linkify(text) {
  return text.split(/(https?:\/\/\S+)/g).map((p, i) => (p.startsWith("http") ? <a key={i} href={p} target="_blank" rel="noreferrer">{p}</a> : p));
}
