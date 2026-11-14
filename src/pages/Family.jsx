import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { useSession } from "../session.jsx";
import { GuardianSetup } from "./Shield.jsx";
import FamilyContact from "../components/FamilyContact.jsx";
import { CameraScan } from "./Checker.jsx";

export default function Family({ go }) {
  const t = useT();
  const s = useSession();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [err, setErr] = useState(null);
  // QR from the protected person's phone: secondthought://open/guardian/CODE (or just the code)
  const onScan = (data) => {
    setScanning(false);
    const m = /guardian\/([A-Za-z0-9]{4,8})/.exec(data) || /^\s*([A-Za-z0-9]{6})\s*$/.exec(data);
    if (m) go(`/guardian/${m[1].toUpperCase()}`); else setErr(t("family_bad_qr"));
  };
  return (
    <div className="stack">
      <h1>{t("family_title")}</h1>
      <FamilyContact />
      <h2 style={{ marginTop: 18 }}>{t("family_live")}</h2>
      <p className="muted" style={{ marginTop: 0 }}>{t("family_live_sub")}</p>
      <GuardianSetup t={t} s={s} />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) go(`/guardian/${code.trim().toUpperCase()}`); }}>
        <h2><Icon name="bell" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("family_watch")}</h2>
        <p className="muted">{t("family_watch_sub")}</p>
        <input className="input code-big" style={{ textAlign: "center" }} value={code} maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" aria-label="Pairing code" />
        <button className="btn primary big block" disabled={code.trim().length < 4}>{t("start")}</button>
        <button type="button" className="btn big block" onClick={() => { setErr(null); setScanning((x) => !x); }}><Icon name="qr" />{scanning ? t("stop") : t("family_scan")}</button>
        {scanning ? <CameraScan onCode={onScan} onError={(m) => { setScanning(false); setErr(m); }} /> : null}
        {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      </form>
    </div>
  );
}
