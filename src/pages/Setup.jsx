import { useEffect, useState } from "react";
import { store } from "../api.js";
import Icon from "../components/Icon.jsx";
import { LANGS, useT } from "../i18n.js";
import { isNative, nativeStatus, ST } from "../native.js";
import FamilyContact, { getContact } from "../components/FamilyContact.jsx";
import { getProfile } from "../profile.js";

// One-time setup (also reachable later from More → Settings).
export default function Setup({ go, lang, setLang, large, setLarge }) {
  const t = useT();
  const [st, setSt] = useState(null);
  const [err, setErr] = useState(null);
  const [contact, setContact] = useState(getContact);
  const refresh = () => nativeStatus().then(setSt);
  useEffect(() => { refresh(); }, []);

  const enableCalls = async () => {
    setErr(null);
    try { await ST.requestCallScreening(); } catch (e) { setErr(e.message); }
    refresh();
  };
  const allowNotifs = async () => { try { await ST.requestNotifications(); } catch (e) { setErr(e.message); } refresh(); };
  const toggleAsk = async (on) => { try { await ST.setUnknownCallPrompt({ enabled: on }); } catch { /* ignore */ } refresh(); };
  const finish = () => { store.set("setupDone", true); go("/"); };

  return (
    <div className="stack">
      <div className="card">
        <h1>{t("setup_title")}</h1>
        <p className="muted">{t("setup_sub")}</p>
      </div>

      {getProfile() ? (
        <button className="bigaction" onClick={() => go("/profile")}>
          <span className="ico"><Icon name="shield" /></span>
          <span><strong>{getProfile().name}</strong><small>{t("profile_edit")} · {getProfile().lock ? t("lock_option") + " ✓" : t("lock_option")}</small></span>
        </button>
      ) : null}
      <div className="card stack">
        <h2>{t("setup_lang")}</h2>
        <div className="grid3">
          {LANGS.map((l) => (
            <button key={l.id} className={`btn big ${lang === l.id ? "primary" : ""}`} aria-pressed={lang === l.id} onClick={() => setLang(l.id)}>{l.label}</button>
          ))}
        </div>
        <label className="row switch">
          <input type="checkbox" checked={large} onChange={(e) => setLarge(e.target.checked)} />
          <span>{t("setup_large")}</span>
        </label>
      </div>

      {!isNative ? <div className="banner info"><Icon name="info" />{t("setup_browser")}</div> : null}

      {isNative && st ? (
        <>
          <Step n={1} done={st.notifications} title={t("setup_notif")} sub={t("setup_notif_sub")}
            action={<button className="btn primary" onClick={allowNotifs}>{t("setup_allow")}</button>} t={t} />
          <Step n={2} done={st.screeningEnabled} title={t("setup_calls")} sub={st.screeningSupported ? t("setup_calls_sub") : t("status_old_android")}
            action={st.screeningSupported ? <button className="btn primary" onClick={enableCalls}>{t("setup_enable")}</button> : null} t={t}>
            {st.screeningEnabled ? (
              <label className="row switch">
                <input type="checkbox" checked={st.unknownCallPrompt} onChange={(e) => toggleAsk(e.target.checked)} />
                <span>{t("setup_calls")}</span>
              </label>
            ) : null}
          </Step>
        </>
      ) : null}

      <Step n={isNative ? 3 : 1} done={Boolean(contact)} title={t("setup_family")} sub={t("setup_family_sub")} t={t} />
      <FamilyContact onSaved={setContact} />

      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      <button className="btn primary big block" onClick={finish}><Icon name="check" />{t("setup_done")}</button>
    </div>
  );
}

function Step({ n, done, title, sub, action, children, t }) {
  return (
    <div className={`card step ${done ? "done" : ""}`}>
      <div className="row" style={{ alignItems: "flex-start", gap: 12 }}>
        <span className="stepnum" aria-hidden="true">{done ? <Icon name="check" /> : n}</span>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>{sub}</p>
          {children}
        </div>
        {done ? <span className="pill on">{t("setup_on")}</span> : action}
      </div>
    </div>
  );
}
