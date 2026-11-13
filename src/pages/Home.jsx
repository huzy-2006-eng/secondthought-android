import { useEffect, useState } from "react";
import { getContact } from "../components/FamilyContact.jsx";
import { callFamily, sendHelp } from "../help.js";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { isNative, nativeStatus, ST } from "../native.js";
import { useSession } from "../session.jsx";

// The first screen: three big buttons, readable at arm's length.
export default function Home({ go, online }) {
  const t = useT();
  const s = useSession();
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => nativeStatus().then(setSt);
  useEffect(() => {
    refresh();
    const on = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const contact = getContact();
  const helper = contact?.name || s.guardian?.guardian_name;
  const help = async () => {
    if (!contact && !s.guardian) { go("/family"); return; }
    setBusy(true); setMsg({ ok: true, text: t("help_sending") });
    const r = await sendHelp(s.guardian);
    if (r.texted) setMsg({ ok: true, text: t("help_texted", { name: contact.name }), call: true });
    else if (r.live) setMsg({ ok: true, text: t("help_sent", { name: s.guardian.guardian_name }) });
    else setMsg({ ok: false, text: contact ? t("help_failed") : t("help_add_number"), add: !contact });
    setBusy(false);
  };

  const turnOn = async () => {
    try { await ST.requestNotifications(); await ST.requestCallScreening(); } catch (e) { setMsg({ ok: false, text: e.message }); }
    refresh();
  };

  const testCall = async () => {
    try { await ST.simulateIncomingCall({ delayMs: 3000 }); setMsg({ ok: true, text: t("test_call_coming") }); }
    catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <div className="stack">
      <div className="hello">
        <Icon name="shield" />
        <div><h1>{t("home_hello")}</h1><p className="muted">{t("home_sub")}</p></div>
      </div>

      {online === false ? <div className="banner info"><span className="pulse" />{t("server_waking")}</div> : null}

      {isNative && st ? (
        !st.screeningSupported ? <div className="banner info"><Icon name="info" />{t("status_old_android")}</div>
        : st.screeningEnabled && st.notifications ? (
          <div className="banner good"><Icon name="check" />{t("status_calls_on")}</div>
        ) : (
          <div className="banner warn" style={{ alignItems: "center" }}>
            <Icon name="alert" />
            <span style={{ flex: 1 }}>{!st.screeningEnabled ? t("status_calls_off") : t("status_notif_off")}</span>
            <button className="btn primary" onClick={turnOn}>{t("status_turn_on")}</button>
          </div>
        )
      ) : null}

      <button className="bigaction" onClick={() => go("/check")}>
        <span className="ico"><Icon name="search" /></span>
        <span><strong>{t("home_check")}</strong><small>{t("home_check_sub")}</small></span>
      </button>
      <button className="bigaction" onClick={() => go("/protect")}>
        <span className="ico"><Icon name="phone" /></span>
        <span><strong>{t("home_protect")}</strong><small>{t("home_protect_sub")}</small></span>
      </button>
      <button className="bigaction danger" onClick={help} disabled={busy}>
        <span className="ico"><Icon name="users" /></span>
        <span><strong>{t("home_help")}</strong><small>{helper ? t("home_help_sub", { name: helper }) : t("home_help_none")}</small></span>
      </button>

      {msg ? <div className={`banner ${msg.ok ? "good" : "bad"}`} role="status"><Icon name={msg.ok ? "check" : "alert"} />{msg.text}</div> : null}
      {contact && (msg?.call || msg?.ok === false) ? (
        <button className="btn primary big block" onClick={callFamily}><Icon name="phone" />{t("call_name", { name: contact.name })}</button>
      ) : null}
      {msg?.add ? <button className="btn big block" onClick={() => go("/family")}>{t("contact_title")}</button> : null}

      {isNative && st?.screeningSupported ? (
        <button className="btn ghost block" onClick={testCall}><Icon name="bell" />{t("try_test_call")}</button>
      ) : null}
    </div>
  );
}
