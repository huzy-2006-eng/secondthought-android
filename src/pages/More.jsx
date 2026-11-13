import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";

const ITEMS = [
  { path: "/protect?mode=demo", icon: "play", key: "more_practice" },
  { path: "/protect?mode=call", icon: "mic", key: "more_listen" },
  { path: "/guardian", icon: "bell", key: "more_watch" },
  { path: "/intel", icon: "graph", key: "more_intel" },
  { path: "/results", icon: "chart", key: "more_results" },
  { path: "/setup", icon: "shield", key: "more_settings" },
];

export default function More({ go }) {
  const t = useT();
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
      <p className="tiny" style={{ textAlign: "center" }}>SecondThought · {t("more_version")} 1.0.0 · Team NeuroNova</p>
    </div>
  );
}
