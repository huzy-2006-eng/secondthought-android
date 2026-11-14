import { useEffect, useState } from "react";
import { paymentCheck } from "../localchecks.js";
import Icon from "../components/Icon.jsx";
import { useT } from "../i18n.js";
import { useSession } from "../session.jsx";

// A stand-in for the bank / UPI app. In production this check runs inside the
// payment app via an SDK, at the moment the user presses "Pay".
export default function Pay({ go }) {
  const t = useT();
  const s = useSession();
  const suggested = (s.snap?.entities || []).find((e) => e.shareable && ["upi", "account", "iban"].includes(e.kind) && e.speaker !== "user");
  const [payee, setPayee] = useState(suggested?.value || "");
  const [amount, setAmount] = useState("");
  const [check, setCheck] = useState(null);
  const [done, setDone] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const r = await paymentCheck(s.snap?.score || 0, payee || null, amount ? Number(amount) : null);
      if (r.decision === "pause") setCheck(r);
      else setDone("sent");
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  if (done) {
    return (
      <div className="card stack">
        <div className={`banner ${done === "sent" ? "good" : "info"}`}><Icon name={done === "sent" ? "check" : "shield"} />
          {done === "sent" ? "Payment sent (demo: no real money moves)." : "Payment cancelled. Well done for stopping to check."}
        </div>
        <button className="btn block" onClick={() => go("/")}>Back to the call</button>
        {done === "cancelled" ? <button className="btn primary block" onClick={() => go("/report")}><Icon name="file" />Report this scam</button> : null}
      </div>
    );
  }
  if (check) return <CoolingOff t={t} check={check} onCancel={() => setDone("cancelled")} onPay={() => setDone("sent")} />;

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="banner info"><Icon name="info" />Demo payment screen. This is what a bank or UPI app would do with SecondThought built in. No real money moves.</div>
      <h1>{t("make_payment")}</h1>
      <div><label className="field" htmlFor="payee">Pay to (UPI ID, account number or IBAN)</label>
        <input id="payee" className="input" value={payee} onChange={(e) => setPayee(e.target.value)} maxLength={200} placeholder="name@bank" /></div>
      <div><label className="field" htmlFor="amt">Amount</label>
        <input id="amt" className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="5000" /></div>
      {!s.sessionId ? <div className="tiny">Not on a protected call right now: only the payee is checked against scam reports.</div> : null}
      <button className="btn primary big block" disabled={busy || !payee}><Icon name="card" />Pay</button>
      {err ? <div className="banner bad"><Icon name="alert" />{err}</div> : null}
    </form>
  );
}

function CoolingOff({ t, check, onCancel, onPay }) {
  const [left, setLeft] = useState(check.cooling_off_seconds || 30);
  const [ticked, setTicked] = useState({});
  useEffect(() => {
    const id = setInterval(() => setLeft((x) => (x > 0 ? x - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="card stack" role="alertdialog" aria-labelledby="cool-title">
      <div className="banner bad"><Icon name="octagon" /><div><strong id="cool-title">{t("cooling_title")}</strong><div>{t("cooling_sub")}</div></div></div>
      <div className="countdown" aria-live="polite">{left}s</div>
      <div>
        {check.reasons.map((r, i) => <p key={i}>• {r}</p>)}
      </div>
      <div className="checklist">
        {check.questions.map((q, i) => (
          <label key={i}><input type="checkbox" checked={!!ticked[i]} onChange={(e) => setTicked({ ...ticked, [i]: e.target.checked })} />{q}</label>
        ))}
      </div>
      <p className="tiny">If you ticked any of these, it is almost certainly a scam.</p>
      <button className="btn primary big block" onClick={onCancel}><Icon name="x" />{t("cancel_payment")}</button>
      <button className="btn block" disabled={left > 0} onClick={onPay}>{left > 0 ? `${t("pay_anyway")} (${left}s)` : t("pay_anyway")}</button>
    </div>
  );
}
