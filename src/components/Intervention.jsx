import { useEffect, useState } from "react";
import Icon from "./Icon.jsx";
import { LangContext, useT } from "../i18n.js";
import { useContext } from "react";
import { scamTypeText, tacticText } from "../tactics_i18n.js";

const HOLD_SECONDS = 10;

// Full-screen cooling-off moment. Plain words, big buttons, the safe choice first.
export default function Intervention({ snap, guardian, ack, onHangUp, onHandOver, onKnowThem, onContinue }) {
  const t = useT();
  const lang = useContext(LangContext);
  const [left, setLeft] = useState(HOLD_SECONDS);

  useEffect(() => {
    setLeft(HOLD_SECONDS);
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    try { navigator.vibrate?.([300, 120, 300]); } catch { /* not supported */ }
    return () => clearInterval(id);
  }, [snap?.session_id]);

  const reasons = (snap?.tactics || []).slice(0, 3);
  let guardianLine = t("guardian_none");
  if (guardian) guardianLine = ack || (snap?.guardian_alerted ? t("guardian_alerted", { name: guardian.guardian_name }) : t("guardian_linked_to", { name: guardian.guardian_name }));

  return (
    <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="stop-title" aria-describedby="stop-sub">
      <div className="inner">
        <Icon name="octagon" className="icon-big" />
        <h1 id="stop-title">{t("stop_title")}</h1>
        <p id="stop-sub" style={{ fontSize: "1.1rem" }}>{t("stop_sub")}</p>
        {snap?.scam_type ? <p><strong>{scamTypeText(lang, snap.scam_type)}</strong> · {snap.score}/100</p> : null}

        <h2 style={{ marginTop: 16 }}>{t("reasons")}</h2>
        {reasons.map((r) => (
          <div className="reason" key={r.tactic}>
            <strong>{tacticText(lang, r).label}</strong>
            {r.evidence?.[0]?.source !== "ml" && r.evidence?.[0]?.quote ? <div style={{ fontStyle: "italic" }}>“{r.evidence[0].quote}”</div> : null}
            <div style={{ fontSize: "0.92rem", marginTop: 2 }}>{tacticText(lang, r).advice}</div>
          </div>
        ))}
        {snap?.intel?.length ? (
          <div className="reason"><strong>{snap.intel[0].value}</strong>: {t("intel_line", { n: snap.intel[0].reports })}{snap.intel[0].includes_demo_data ? " (demo)" : ""}</div>
        ) : null}

        <div className="guardian-line" role="status" aria-live="polite">
          <Icon name="users" style={{ width: 18, height: 18, verticalAlign: "-3px", marginRight: 6 }} />
          {guardianLine}
        </div>
        <p style={{ fontSize: "0.92rem" }}>{t("real_check")}</p>

        <div className="stack" style={{ marginTop: 14 }}>
          <button className="btn primary big block" onClick={onHangUp} autoFocus><Icon name="phoneOff" />{t("hang_up")}</button>
          <button className="btn block" onClick={onHandOver}><Icon name="bot" />{t("hand_over")}</button>
          <div className="grid2">
            <button className="btn" onClick={onKnowThem}>{t("i_know")}</button>
            <button className="btn" onClick={onContinue} disabled={left > 0}>
              {left > 0 ? t("continue_in", { s: left }) : t("continue_anyway")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
