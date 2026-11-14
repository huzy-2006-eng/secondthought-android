import FamilyContact, { getContact } from "../components/FamilyContact.jsx";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { getProfile } from "../profile.js";

// "Setting up for a parent": who should they call when something looks wrong? (usually the person setting it up)
export default function Caregiver({ go }) {
  const t = useT();
  const name = getProfile()?.name || "";
  return (
    <div className="stack">
      <div>
        <h1 style={{ marginBottom: 4 }}>{t("care_title", { name })}</h1>
        <p className="muted" style={{ margin: 0 }}>{t("care_sub", { name })}</p>
      </div>
      <div className="banner info"><Icon name="info" />{t("care_simple")}</div>
      <FamilyContact onSaved={() => go("/setup")} />
      <button className="btn ghost block" onClick={() => go("/setup")}>{getContact() ? t("profile_continue") : t("care_later")}</button>
    </div>
  );
}
