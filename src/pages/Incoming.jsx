import { useEffect, useState } from "react";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { useSession } from "../session.jsx";

const mask = (n) => { const d = (n || "").replace(/\D/g, ""); return d.length > 4 ? "••••" + d.slice(-4) : d; };

// Opened from the "Unknown number calling. Protect this call?" notification.
// Asks again before doing anything; never listens on its own.
export default function Incoming({ query, go }) {
  const t = useT();
  const s = useSession();
  const number = query.get("n") || "";
  const simulated = query.get("sim") === "1";
  const [agreed, setAgreed] = useState(query.get("protect") === "1");
  const [check, setCheck] = useState(null);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let stop = false;
    setCheck(null); setFailed(false);
    const tryOnce = (left) => api.callerCheck(number || "0000").then((c) => { if (!stop) setCheck(c); })
      .catch(() => { if (stop) return; if (left > 0) setTimeout(() => tryOnce(left - 1), 4000); else setFailed(true); });
    tryOnce(8); // the free server may take up to a minute to wake up
    return () => { stop = true; };
  }, [number]);

  const reported = check && check.verdict !== "unknown";
  const help = async () => {
    if (!s.guardian) { go("/family"); return; }
    try { await api.help(s.guardian.code, mask(number)); setMsg({ ok: true, text: t("help_sent", { name: s.guardian.guardian_name }) }); }
    catch { setMsg({ ok: false, text: t("help_failed") }); }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="row" style={{ gap: 12 }}>
          <span className={`callicon ${reported ? "bad" : ""}`}><Icon name="phone" /></span>
          <div>
            <h1 style={{ margin: 0 }}>{t("inc_title")}</h1>
            <div className="code-big" style={{ fontSize: "1.4rem" }}>{mask(number) || "—"}</div>
          </div>
        </div>
        {simulated ? <div className="banner info" style={{ marginTop: 12 }}><Icon name="info" />{t("inc_test")}</div> : null}
        <div style={{ marginTop: 12 }}>
          {!check && !failed ? <div className="banner info"><span className="pulse" />{t("inc_checking")}</div> : null}
          {failed ? <div className="banner warn"><Icon name="alert" />{t("inc_offline")}</div> : null}
          {check && reported ? (
            <div className="banner bad"><Icon name="octagon" />
              <span>{t("inc_reported", { n: check.reports, r: check.reporters })}{check.includes_demo_data ? ` ${t("inc_demo_data")}` : ""}</span>
            </div>
          ) : null}
          {check && !reported ? <div className="banner good"><Icon name="info" />{t("inc_not_reported")}</div> : null}
        </div>
      </div>

      {!agreed ? (
        <div className="card stack">
          <h2>{t("inc_question")}</h2>
          <button className="btn primary big block" onClick={() => setAgreed(true)}><Icon name="shield" />{t("inc_yes")}</button>
          <button className="btn big block" onClick={() => go("/")}>{t("inc_no")}</button>
        </div>
      ) : (
        <>
          <div className="card">
            <h2><Icon name="shield" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("inc_protected")}</h2>
            <h3 style={{ marginTop: 10 }}>{t("inc_tips")}</h3>
            <ul className="tips">{(check?.tips || []).map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <button className="bigaction danger" onClick={help}>
            <span className="ico"><Icon name="users" /></span>
            <span><strong>{t("home_help")}</strong><small>{s.guardian ? t("home_help_sub", { name: s.guardian.guardian_name }) : t("home_help_none")}</small></span>
          </button>
          {msg ? <div className={`banner ${msg.ok ? "good" : "bad"}`} role="status"><Icon name={msg.ok ? "check" : "alert"} />{msg.text}</div> : null}
          {simulated ? (
            <button className="bigaction" onClick={() => go("/protect?mode=demo&scenario=en_digital_arrest")}>
              <span className="ico"><Icon name="play" /></span><span><strong>{t("inc_play_demo")}</strong><small>{t("inc_test")}</small></span>
            </button>
          ) : null}
          <button className="bigaction" onClick={() => go("/protect?mode=chat")}>
            <span className="ico"><Icon name="chat" /></span><span><strong>{t("inc_type")}</strong><small>{t("inc_type_sub")}</small></span>
          </button>
          <button className="bigaction" onClick={() => go("/protect?mode=call")}>
            <span className="ico"><Icon name="mic" /></span><span><strong>{t("inc_listen")}</strong><small>{t("inc_listen_sub")}</small></span>
          </button>
          <p className="tiny">{t("inc_same_phone")}</p>
        </>
      )}
    </div>
  );
}
