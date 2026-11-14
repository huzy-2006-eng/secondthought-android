import { useEffect, useRef, useState } from "react";
import { GlowShield } from "./Brand.jsx";
import Icon from "./Icon.jsx";
import { useT } from "../i18n.js";
import { ST } from "../native.js";

// Shown when the app lock is on: fingerprint, face or the phone's own PIN.
export default function LockScreen({ name, onUnlock }) {
  const t = useT();
  const [err, setErr] = useState(null);
  const asked = useRef(false);
  const unlock = async () => {
    setErr(null);
    try { await ST.unlock({ title: t("lock_prompt_title"), subtitle: t("lock_prompt_sub") }); onUnlock(); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { if (!asked.current) { asked.current = true; setTimeout(unlock, 250); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="lockscreen">
      <div className="lock-shield"><GlowShield size={130} /></div>
      <h1>{name ? t("lock_hello", { name }) : t("lock_title")}</h1>
      <p className="muted">{t("lock_sub")}</p>
      <button className="btn primary big block" onClick={unlock}><Icon name="shield" />{t("lock_unlock")}</button>
      {err ? <div className="banner bad" style={{ marginTop: 12 }}><Icon name="alert" />{err}</div> : null}
      <p className="tiny" style={{ marginTop: 18 }}>{t("lock_private")}</p>
    </div>
  );
}
