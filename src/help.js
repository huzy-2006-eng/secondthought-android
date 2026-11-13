// "Help! Alert my family": text (and offer to call) the family member's own phone number.
// Works with no internet. If the SecondThought server can also push a live alert to a paired
// family screen, that is sent too, but nothing depends on it.
import { serverHelp } from "./api.js";
import { getContact } from "./components/FamilyContact.jsx";
import { isNative, ST } from "./native.js";

export function helpMessage(callerHint) {
  return "I need help. " + (callerHint ? `I'm getting a suspicious call from a number ending ${callerHint.replace(/\D/g, "")}. ` : "")
    + "It might be a scam. Please call me now. (sent from SecondThought)";
}

export async function sendHelp(guardian, callerHint) {
  const contact = getContact();
  const live = serverHelp(guardian, callerHint);           // in the background; may be unsupported
  let texted = false;
  if (contact?.phone) {
    const body = helpMessage(callerHint);
    if (isNative) { try { await ST.sms({ to: contact.phone, body }); texted = true; } catch { /* no SMS app */ } }
    else { location.href = `sms:${encodeURIComponent(contact.phone)}?body=${encodeURIComponent(body)}`; texted = true; }
  }
  return { texted, live: await live, contact };
}

export async function callFamily() {
  const c = getContact();
  if (!c?.phone) return false;
  if (isNative) await ST.dial({ to: c.phone });
  else location.href = `tel:${c.phone}`;
  return true;
}
