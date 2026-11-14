import { useEffect, useState } from "react";
import Icon from "../components/Icon.jsx";
import { GlowShield } from "../components/Brand.jsx";
import { useT } from "../i18n.js";
import { isNative, ST } from "../native.js";
import { getProfile, setProfile } from "../profile.js";

// "Create your profile": a name, who the app protects, and the optional fingerprint / face / PIN lock.
export default function Profile({ go, next = "/setup", editing = false }) {
  const t = useT();
  const saved = getProfile() || {};
  const [name, setName] = useState(saved.name || "");
  const [role, setRole] = useState(saved.role || "self");
  const [lockOk, setLockOk] = useState(false);
  const [lock, setLock] = useState(saved.lock ?? true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isNative) return;
    ST.lockAvailable().then((r) => { setLockOk(Boolean(r.available)); if (!r.available) setLock(false); }).catch(() => setLock(false));
  }, []);

  const save = async () => {
    setErr(null);
    let useLock = lockOk && lock;
    if (useLock && !saved.lock) {   // turning the lock on: make sure it works on this phone first
      try { await ST.unlock({ title: t("lock_prompt_title"), subtitle: t("lock_confirm_sub") }); }
      catch (e) { setErr(e.message); return; }
    }
    setProfile({ name: name.trim().slice(0, 40), role, lock: useLock });
    go(next);
  };

  return (
    <div className="stack profile">
      {!editing ? <div className="profile-hero"><GlowShield size={84} /></div> : null}
      <div>
        <h1 style={{ marginBottom: 4 }}>{editing ? t("profile_edit") : t("profile_title")}</h1>
        <p className="muted" style={{ margin: 0 }}>{t("profile_sub")}</p>
      </div>
      <div className="card stack">
        <label className="field" htmlFor="pf-name">{role === "family" ? t("profile_name_family") : t("profile_name")}</label>
        <input id="pf-name" className="input big" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={t("profile_name_ph")} autoComplete="given-name" />
        <div className="field" style={{ marginTop: 6 }}>{t("profile_who")}</div>
        <div className="choice2" role="radiogroup">
          {[["self", "user", t("profile_self")], ["family", "users", t("profile_family")]].map(([id, icon, label]) => (
            <button key={id} type="button" role="radio" aria-checked={role === id} className={`choice ${role === id ? "on" : ""}`} onClick={() => setRole(id)}>
              <span className="cico"><Icon name={icon === "user" ? "shield" : "users"} /></span>{label}
            </button>
          ))}
        </div>
      </div>
      {isNative ? (
        <div className={`card lockcard ${lockOk ? "" : "disabled"}`}>
          <div className="row" style={{ gap: 14, flexWrap: "nowrap" }}>
            <span className="cico big"><Icon name="shield" /></span>
            <div style={{ flex: 1 }}>
              <strong>{t("lock_option")}</strong>
              <div className="tiny">{lockOk ? t("lock_option_sub") : t("lock_unavailable")}</div>
            </div>
            <label className="toggle"><input type="checkbox" checked={lock && lockOk} disabled={!lockOk} onChange={(e) => setLock(e.target.checked)} /><i /></label>
          </div>
        </div>
      ) : null}
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
      <button className="btn primary big block" disabled={!name.trim()} onClick={save}>{editing ? t("profile_save") : t("profile_continue")}</button>
      <p className="tiny" style={{ textAlign: "center" }}>{t("lock_private")}</p>
    </div>
  );
}
