import { APP_VERSION } from "../version.js";
import Icon from "../components/Icon.jsx";
import { useState } from "react";
import { useT } from "../i18n.js";
import { store } from "../api.js";
import { useSession } from "../session.jsx";

const ITEMS = [
  { path: "/protect?mode=demo", icon: "play", key: "more_practice" },
  { path: "/guardian", icon: "bell", key: "more_watch" },
  { path: "/intel", icon: "graph", key: "more_intel" },
  { path: "/setup", icon: "shield", key: "more_settings" },
];

// Sign out = forget this phone's profile and everything SecondThought saved on it, then start again.
const SAVED = ["profile", "setupDone", "familyContact", "guardian", "watchCode", "trapStats", "checkStats", "trapPersona", "large"];

export default function More({ go }) {
  const t = useT();
  const s = useSession();
  const [confirm, setConfirm] = useState(false);
  const signOut = async () => {
    try { await s.reset(true); } catch { /* ignore */ }
    SAVED.forEach((k) => store.set(k, null));
    location.hash = "/welcome";
    location.reload();
  };
  return (
    <div className="stack">
      <h1>{t("more_title")}</h1>
      <div className="card list">
        {ITEMS.map((i) => (
          <button key={i.path} className="listitem" onClick={() => go(i.path)}>
            <Icon name={i.icon} /><span>{t(i.key)}</span><span className="chev" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
      <div className="card">
        <h2>{t("more_privacy")}</h2>
        <ul className="tips">
          {["privacy_1", "privacy_2", "privacy_3", "privacy_4"].map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </div>
      {!confirm ? (
        <button className="btn block signout" onClick={() => setConfirm(true)}><Icon name="x" />{t("signout")}</button>
      ) : (
        <div className="card stack signout-card" role="alertdialog" aria-labelledby="so-title">
          <h2 id="so-title" style={{ margin: 0 }}>{t("signout_q")}</h2>
          <p className="muted" style={{ margin: 0 }}>{t("signout_sub")}</p>
          <button className="btn danger big block" onClick={signOut}>{t("signout_yes")}</button>
          <button className="btn big block" onClick={() => setConfirm(false)}>{t("signout_no")}</button>
        </div>
      )}
      <p className="tiny" style={{ textAlign: "center" }}>SecondThought · {t("more_version")} {APP_VERSION} · Team NeuroNova</p>
    </div>
  );
}
