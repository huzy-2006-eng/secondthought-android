import { GlowShield } from "../components/Brand.jsx";
import { useT } from "../i18n.js";

// First screen on first launch.
export default function Welcome({ go }) {
  const t = useT();
  return (
    <div className="welcome">
      <div className="hero"><GlowShield /></div>
      <h1>{t("welcome_title")}</h1>
      <p>{t("welcome_sub")}</p>
      <div className="dots" aria-hidden="true"><i className="on" /><i /><i /></div>
      <button className="btn primary big block" style={{ minHeight: 58, fontSize: "1.15rem" }} onClick={() => go("/setup")}>{t("welcome_start")}</button>
    </div>
  );
}
