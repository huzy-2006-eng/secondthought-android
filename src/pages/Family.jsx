import { useState } from "react";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { useSession } from "../session.jsx";
import { GuardianSetup } from "./Shield.jsx";

export default function Family({ go }) {
  const t = useT();
  const s = useSession();
  const [code, setCode] = useState("");
  return (
    <div className="stack">
      <h1>{t("family_title")}</h1>
      <GuardianSetup t={t} s={s} />
      <form className="card stack" onSubmit={(e) => { e.preventDefault(); if (code.trim().length >= 4) go(`/guardian/${code.trim().toUpperCase()}`); }}>
        <h2><Icon name="bell" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("family_watch")}</h2>
        <p className="muted">{t("family_watch_sub")}</p>
        <input className="input code-big" style={{ textAlign: "center" }} value={code} maxLength={8}
          onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC123" aria-label="Pairing code" />
        <button className="btn primary big block" disabled={code.trim().length < 4}>{t("start")}</button>
      </form>
    </div>
  );
}
