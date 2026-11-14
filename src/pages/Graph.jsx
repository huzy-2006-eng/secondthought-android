import { useEffect, useMemo, useRef, useState } from "react";
import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY } from "d3-force";
import { api } from "../api.js";
import Icon from "../components/Icon.jsx";

// Intel graph: reports (circles) linked to the scammer identifiers they share (squares).
// Two node types = two categorical slots; a selected campaign is shown by emphasis, not by a new hue.
export default function Graph() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");

  const load = () => api.graph().then(setData).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const match = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !data) return null;
    return data.campaigns.find((c) => c.identifiers.some((i) => i.value.toLowerCase().includes(q)))?.id || "none";
  }, [query, data]);
  const active = match && match !== "none" ? match : selected;

  if (err) return <div className="banner bad"><Icon name="alert" />{err}</div>;
  if (!data) return <div className="empty">Loading the intel graph…</div>;
  const multi = data.campaigns.filter((c) => c.reports > 1);

  return (
    <>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h1 style={{ marginBottom: 2 }}>Scam intel network</h1>
          <p className="muted" style={{ margin: 0 }}>Reports that share a payment handle, account, phone number or link belong to the same operation.</p>
        </div>
        <button className="btn" onClick={load}>Refresh</button>
      </div>
      {data.stats.demo_data ? <div className="banner warn"><Icon name="info" /><div>Includes <strong>synthetic demo data</strong> so the network isn't empty before real reports exist. Demo identifiers are fictional (demo- prefixes, example.com sites, impossible numbers).</div></div> : null}
      <div className="tiles net">
        <div className="tile"><div className="value">{data.stats.reports}</div><div className="label">Reports</div></div>
        <div className="tile"><div className="value">{data.stats.identifiers}</div><div className="label">Scammer identifiers</div></div>
        <div className="tile"><div className="value">{data.stats.campaigns}</div><div className="label">Linked campaigns</div></div>
      </div>
      <div className="two-col">
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="legend">
              <span><i className="lg-report" />Report</span>
              <span><i className="lg-ident" />Scammer detail (UPI, account, phone, link)</span>
            </div>
            <input className="input" style={{ maxWidth: 240 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a UPI ID, number, link…" aria-label="Search identifiers" />
          </div>
          {match === "none" ? <div className="banner info"><Icon name="search" />Not found in any report.</div> : null}
          <ForceGraph data={data} active={active} onSelect={setSelected} />
        </div>
        <div>
          <h2>Campaigns</h2>
          {multi.map((c) => (
            <div key={c.id} className={`card campaign ${active === c.id ? "selected" : ""}`} data-n={c.reports} role="button" tabIndex={0}
              onClick={() => { setQuery(""); setSelected(active === c.id ? null : c.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(active === c.id ? null : c.id); } }}>
              <strong>{c.scam_types[0] || "Unclassified"}</strong>
              <div className="tiny">{c.reports} reports · {c.reporters} independent reporters · {c.identifiers.length} identifiers{c.demo_data ? " · demo data" : ""}</div>
              {active === c.id ? <div className="row" style={{ marginTop: 6 }}>{c.identifiers.map((i) => <span key={i.kind + i.value} className="chip"><strong>{i.kind.toUpperCase()}</strong> {i.value}</span>)}</div> : null}
            </div>
          ))}
          <details className="camplist">
            <summary>All campaigns ({data.campaigns.length})</summary>
            {data.campaigns.map((c) => (
              <div key={c.id} className="camprow">
                <div className="camprow-head">
                  <strong>{c.scam_types[0] || "Unclassified scam"}</strong>
                  {c.demo_data ? <span className="demo">demo</span> : null}
                </div>
                <div className="camprow-stats">
                  <span><b>{c.reports}</b> report{c.reports !== 1 ? "s" : ""}</span>
                  <span><b>{c.reporters}</b> reporter{c.reporters !== 1 ? "s" : ""}</span>
                  <span><b>{c.identifiers.length}</b> detail{c.identifiers.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="camprow-ids">
                  {c.identifiers.map((i) => <span key={i.kind + i.value} className="idchip"><em>{i.kind.toUpperCase()}</em>{i.value}</span>)}
                </div>
              </div>
            ))}
          </details>
        </div>
      </div>
    </>
  );
}

function ForceGraph({ data, active, onSelect }) {
  const box = useRef(null);
  const [size, setSize] = useState({ w: 700, h: 460 });
  const [nodes, setNodes] = useState([]);
  const [links, setLinks] = useState([]);
  const [tip, setTip] = useState(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const ns = data.nodes.map((n) => ({ ...n }));
    const ls = data.edges.map((e) => ({ ...e }));
    const sim = forceSimulation(ns)
      .force("link", forceLink(ls).id((d) => d.id).distance(34).strength(0.9))
      .force("charge", forceManyBody().strength(-60))
      .force("center", forceCenter(size.w / 2, size.h / 2))
      .force("x", forceX(size.w / 2).strength(0.06))
      .force("y", forceY(size.h / 2).strength(0.08))
      .force("collide", forceCollide(9))
      .stop();
    for (let i = 0; i < 300; i++) sim.tick();
    ns.forEach((n) => { n.x = Math.max(12, Math.min(size.w - 12, n.x)); n.y = Math.max(12, Math.min(size.h - 12, n.y)); });
    setNodes(ns); setLinks(ls);
  }, [data, size.w, size.h]);

  const camOfIdent = useMemo(() => {
    const m = new Map();
    links.forEach((l) => m.set(l.target.id, l.source.campaign));
    return m;
  }, [links]);
  const inActive = (n) => !active || (n.type === "report" ? n.campaign === active : camOfIdent.get(n.id) === active);

  // campaign halos: a soft glow around every operation with more than one report
  const halos = useMemo(() => {
    const by = new Map();
    nodes.forEach((n) => {
      const c = n.type === "report" ? n.campaign : camOfIdent.get(n.id);
      if (!c) return;
      if (!by.has(c)) by.set(c, []);
      by.get(c).push(n);
    });
    return Array.from(by.entries()).filter(([, ns]) => ns.filter((n) => n.type === "report").length > 1).map(([id, ns]) => {
      const cx = ns.reduce((a, n) => a + n.x, 0) / ns.length, cy = ns.reduce((a, n) => a + n.y, 0) / ns.length;
      const r = Math.max(...ns.map((n) => Math.hypot(n.x - cx, n.y - cy))) + 22;
      return { id, cx, cy, r };
    });
  }, [nodes, camOfIdent]);
  const curve = (l) => {
    const mx = (l.source.x + l.target.x) / 2, my = (l.source.y + l.target.y) / 2;
    const dx = l.target.x - l.source.x, dy = l.target.y - l.source.y;
    return `M${l.source.x},${l.source.y} Q${mx - dy * 0.18},${my + dx * 0.18} ${l.target.x},${l.target.y}`;
  };

  return (
    <div className="graph-box" ref={box}>
      <svg role="img" aria-label={`Network of ${data.stats.reports} reports and ${data.stats.identifiers} identifiers in ${data.stats.campaigns} linked campaigns`}>
        <defs>
          <radialGradient id="g-report" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#c9c2ff" /><stop offset="0.45" stopColor="#8f7bff" /><stop offset="1" stopColor="#5a3fe0" /></radialGradient>
          <radialGradient id="g-ident" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#ffc0dc" /><stop offset="0.45" stopColor="#ff4d9a" /><stop offset="1" stopColor="#c0186a" /></radialGradient>
          <radialGradient id="g-halo"><stop offset="0" stopColor="#9b3cf0" stopOpacity="0.22" /><stop offset="0.7" stopColor="#e0307a" stopOpacity="0.08" /><stop offset="1" stopColor="#e0307a" stopOpacity="0" /></radialGradient>
          <radialGradient id="g-halo-on"><stop offset="0" stopColor="#ff4d9a" stopOpacity="0.38" /><stop offset="0.7" stopColor="#9b3cf0" stopOpacity="0.16" /><stop offset="1" stopColor="#9b3cf0" stopOpacity="0" /></radialGradient>
          <linearGradient id="g-link" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size.w} y2={size.h}><stop offset="0" stopColor="#8f7bff" /><stop offset="1" stopColor="#ff4d9a" /></linearGradient>
          <filter id="glow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="3.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <g>{halos.map((h) => (
          <circle key={h.id} cx={h.cx} cy={h.cy} r={h.r} fill={active === h.id ? "url(#g-halo-on)" : "url(#g-halo)"}
            stroke={active === h.id ? "#ff4d9a" : "#ffffff"} strokeOpacity={active === h.id ? 0.5 : 0.06} strokeDasharray="3 6"
            style={{ cursor: "pointer" }} onClick={() => onSelect(h.id)} />
        ))}</g>
        <g fill="none">
          {links.map((l, i) => (
            <path key={i} d={curve(l)} stroke="url(#g-link)" strokeOpacity={inActive(l.source) ? (active ? 0.9 : 0.5) : 0.06} strokeWidth={active && inActive(l.source) ? 2.2 : 1.4} strokeLinecap="round" />
          ))}
        </g>
        <g>
          {nodes.map((n) => {
            const on = inActive(n);
            const common = {
              opacity: on ? 1 : 0.18, filter: on ? "url(#glow)" : undefined, style: { cursor: "pointer" },
              onMouseEnter: () => setTip(n), onMouseLeave: () => setTip(null),
              onClick: () => { setTip(n); onSelect(n.type === "report" ? n.campaign : camOfIdent.get(n.id)); },
            };
            if (n.type === "report") return <circle key={n.id} {...common} cx={n.x} cy={n.y} r={6.5} fill="url(#g-report)" stroke="#0c0a12" strokeWidth="1.5" />;
            const r = 6 + Math.min(5, n.reporters || 1);
            return <rect key={n.id} {...common} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} rx={r * 0.45} fill="url(#g-ident)" stroke="#0c0a12" strokeWidth="1.5"
              transform={`rotate(45 ${n.x} ${n.y})`} />;
          })}
        </g>
      </svg>
      {tip ? (
        <div className="tooltip" style={{ left: Math.min(tip.x + 12, size.w - 250), top: Math.max(4, tip.y - 40) }}>
          {tip.type === "report"
            ? <>Report · {tip.scam_type || "unclassified"}<br />{new Date(tip.created_at * 1000).toLocaleDateString()} · {tip.source === "demo_seed" ? "demo data" : tip.source}</>
            : <>{tip.kind.toUpperCase()}: {tip.value}<br />{tip.reporters} independent reporter(s)</>}
        </div>
      ) : null}
    </div>
  );
}
