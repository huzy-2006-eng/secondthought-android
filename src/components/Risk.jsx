import Icon from "./Icon.jsx";
import { useContext } from "react";
import { LangContext, useT } from "../i18n.js";
import { tacticText } from "../tactics_i18n.js";

const LEVEL = {
  safe: { color: "var(--good)", icon: "check" },
  caution: { color: "var(--warning)", icon: "info" },
  high: { color: "var(--critical)", icon: "alert" },
  critical: { color: "var(--critical)", icon: "octagon" },
};

export function LevelBadge({ level = "safe" }) {
  const t = useT();
  const l = LEVEL[level] || LEVEL.safe;
  return (
    <span className={`level ${level}`}>
      <span className="dot" style={{ background: l.color }} aria-hidden="true" />
      <Icon name={l.icon} />
      {t(`level_${level}`)}
    </span>
  );
}

// Semicircular gauge. The colored arc, number and badge always agree; color is never the only cue.
export function RiskMeter({ snap }) {
  const score = snap?.score ?? 0;
  const level = snap?.level ?? "safe";
  const color = (LEVEL[level] || LEVEL.safe).color;
  const r = 52, cx = 66, cy = 70;
  const len = Math.PI * r;
  const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="meter" role="group" aria-label={`Scam risk ${score} out of 100, ${level}`}>
      <svg viewBox="0 0 132 84" aria-hidden="true">
        <path d={arc} fill="none" stroke="var(--surface-2)" strokeWidth="12" strokeLinecap="round" />
        <path d={arc} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
          strokeDasharray={`${(len * score) / 100} ${len}`} style={{ transition: "stroke-dasharray .5s ease" }} />
        <line x1={cx + r * Math.cos(Math.PI * (1 - 0.6))} y1={cy - r * Math.sin(Math.PI * (1 - 0.6)) - 9}
          x2={cx + r * Math.cos(Math.PI * (1 - 0.6))} y2={cy - r * Math.sin(Math.PI * (1 - 0.6)) + 9}
          stroke="var(--text-3)" strokeWidth="2" />
      </svg>
      <div>
        <div className="score" aria-live="polite">{score}<span className="tiny"> /100</span></div>
        <LevelBadge level={level} />
        <div className="tiny" style={{ marginTop: 4 }}>Alert line at 60</div>
      </div>
    </div>
  );
}

export function TacticList({ tactics = [], limit = 5 }) {
  const lang = useContext(LangContext);
  if (!tactics.length) return null;
  return (
    <div className="stack">
      {tactics.slice(0, limit).map((t) => (
        <div className="tactic" key={t.tactic}>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <strong>{tacticText(lang, t).label}</strong>
            <span className="sources">
              {t.sources.map((s) => (
                <span className="source" key={s} title={{ rule: "Hand-written rule", ml: "Trained model", llm: "LLM second opinion" }[s]}>
                  {{ rule: "rule", ml: "model", llm: "LLM" }[s] || s}
                </span>
              ))}
            </span>
          </div>
          {t.evidence?.[0]?.source !== "ml" && t.evidence?.[0]?.quote ? <div className="quote">“{t.evidence[0].quote}”</div> : null}
          <div className="advice">{tacticText(lang, t).advice}</div>
        </div>
      ))}
    </div>
  );
}

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function highlight(text, quotes) {
  const qs = quotes.filter((q) => q && q.length > 2 && text.toLowerCase().includes(q.toLowerCase()));
  if (!qs.length) return text;
  const re = new RegExp(`(${qs.map(escapeRe).join("|")})`, "gi");
  return text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export function Transcript({ turns = [], snap, labels = { other: "Caller", user: "You", persona: "SecondThought persona" }, interim }) {
  const quotes = (snap?.tactics || []).flatMap((t) => (t.evidence || []).filter((e) => e.source !== "ml").map((e) => e.quote));
  if (!turns.length && !interim) return <div className="empty">Nothing yet.</div>;
  return (
    <div className="transcript" aria-live="polite">
      {turns.map((t, i) => (
        <div className={`bubble ${t.speaker}`} key={i}>
          <span className="who">{labels[t.speaker] || t.speaker}</span>
          {t.speaker === "other" ? highlight(t.text, quotes) : t.text}
        </div>
      ))}
      {interim ? <div className="bubble other interim">{interim}</div> : null}
    </div>
  );
}

export function Identifiers({ entities = [], intel = [] }) {
  const t = useT();
  const shown = entities.filter((e) => e.shareable || e.kind === "amount");
  if (!shown.length) return null;
  const hit = new Map(intel.map((i) => [`${i.kind}:${i.value}`, i]));
  return (
    <div className="row">
      {shown.map((e) => {
        const h = hit.get(`${e.kind}:${e.value}`);
        return (
          <span key={`${e.kind}:${e.value}`} className={`chip ${h ? "warn" : ""}`} title={h ? `${t("seen_in_reports")}: ${h.reports}` : e.kind}>
            <strong>{e.kind.toUpperCase()}</strong> {e.value}
            {h ? <span>· {t("seen_in_reports")} ({h.reports}{h.includes_demo_data ? ", demo" : ""})</span> : null}
          </span>
        );
      })}
    </div>
  );
}
