import { useState } from "react";
import { store } from "../api.js";
import Icon from "./Icon.jsx";
import { useT } from "../i18n.js";

// The family member's name and phone number, kept ONLY on this phone. "Help" texts or calls this number,
// so it works without the internet and without the SecondThought server.
export function getContact() { return store.get("familyContact"); }

export default function FamilyContact({ onSaved }) {
  const t = useT();
  const saved = getContact();
  const [name, setName] = useState(saved?.name || "");
  const [phone, setPhone] = useState(saved?.phone || "");
  const [done, setDone] = useState(Boolean(saved));
  const valid = name.trim() && phone.replace(/\D/g, "").length >= 8;
  const save = () => {
    const c = { name: name.trim().slice(0, 40), phone: phone.trim().slice(0, 20) };
    store.set("familyContact", c); setDone(true); onSaved?.(c);
  };
  if (done && saved) {
    return (
      <div className="card">
        <h2><Icon name="phone" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("contact_title")}</h2>
        <p style={{ fontSize: "1.1rem", margin: "6px 0" }}><strong>{saved.name}</strong> · {saved.phone}</p>
        <p className="tiny">{t("contact_private")}</p>
        <button className="btn ghost" onClick={() => setDone(false)}>{t("contact_change")}</button>
      </div>
    );
  }
  return (
    <div className="card stack">
      <h2><Icon name="phone" style={{ width: 20, height: 20, verticalAlign: "-4px" }} /> {t("contact_title")}</h2>
      <p className="muted">{t("contact_sub")}</p>
      <div><label className="field" htmlFor="fc-name">{t("contact_name")}</label>
        <input id="fc-name" className="input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="e.g. Huzaifa (son)" /></div>
      <div><label className="field" htmlFor="fc-phone">{t("contact_phone")}</label>
        <input id="fc-phone" className="input" type="tel" inputMode="tel" value={phone} maxLength={20} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
      <button className="btn primary big block" disabled={!valid} onClick={save}><Icon name="check" />{t("contact_save")}</button>
      <p className="tiny">{t("contact_private")}</p>
    </div>
  );
}
