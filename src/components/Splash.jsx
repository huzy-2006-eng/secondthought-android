import { GlowShield } from "./Brand.jsx";
import { useT } from "../i18n.js";

// Opening animation: the shield appears with a glow, then the name and tagline. ~1.6 s, then the app.
export default function Splash({ leaving }) {
  const t = useT();
  return (
    <div className={`splash ${leaving ? "leaving" : ""}`} aria-label="SecondThought">
      <div className="splash-glow" />
      <div className="splash-shield"><GlowShield size={170} /></div>
      <div className="splash-name">Second<span>Thought</span></div>
      <div className="splash-tag">{t("splash_tag")}</div>
      <div className="splash-bar"><i /></div>
    </div>
  );
}
