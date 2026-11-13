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
      <div className="tiles">
        <div className="tile"><div className="value">{data.stats.reports}</div><div className="label">Reports</div></div>
        <div className="tile"><div className="value">{data.stats.identifiers}</div><div className="label">Scammer identifiers</div></div>
        <div className="tile"><div className="value">{data.stats.campaigns}</div><div className="label">Linked campaigns</div></div>
      </div>
      <div className="two-col">
        <div>
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
            <div className="legend">
              <span><i style={{ background: "var(--series-1)", borderRadius: "50%" }} />Report</span>
              <span><i style={{ background: "var(--series-2)", borderRadius: 3 }} />Identifier (UPI, account, phone, link)</span>
            </div>
            <input className="input" style={{ maxWidth: 240 }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a UPI ID, number, link…" aria-label="Search identifiers" />
          </div>
          {match === "none" ? <div className="banner info"><Icon name="search" />Not found in any report.</div> : null}
          <ForceGraph data={data} active={active} onSelect={setSelected} />
        </div>
        <div>
          <h2>Campaigns</h2>
          {multi.map((c) => (
            <div key={c.id} className={`card campaign ${active === c.id ? "selected" : ""}`} role="button" tabIndex={0}
              onClick={() => { setQuery(""); setSelected(active === c.id ? null : c.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(active === c.id ? null : c.id); } }}>
              <strong>{c.scam_types[0] || "Unclassified"}</strong>
              <div className="tiny">{c.reports} reports · {c.reporters} independent reporters · {c.identifiers.length} identifiers{c.demo_data ? " · demo data" : ""}</div>
              {active === c.id ? <div className="row" style={{ marginTop: 6 }}>{c.identifiers.map((i) => <span key={i.kind + i.value} className="chip"><strong>{i.kind.toUpperCase()}</strong> {i.value}</span>)}</div> : null}
            </div>
          ))}
          <details>
            <summary className="tiny" style={{ cursor: "pointer" }}>Table view</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Campaign</th><th className="num">Reports</th><th className="num">Reporters</th><th>Identifiers</th></tr></thead>
                <tbody>{data.campaigns.map((c) => (
                  <tr key={c.id}><td>{c.scam_types[0] || c.id}</td><td className="num">{c.reports}</td><td className="num">{c.reporters}</td>
                    <td>{c.identifiers.map((i) => `${i.kind}: ${i.value}`).join(", ")}</td></tr>))}</tbody>
              </table>
            </div>
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

  return (
    <div className="graph-box" ref={box}>
      <svg role="img" aria-label={`Network of ${data.stats.reports} reports and ${data.stats.identifiers} identifiers in ${data.stats.campaigns} linked campaigns`}>
        <g>
          {links.map((l, i) => (
            <line key={i} x1={l.source.x} y1={l.source.y} x2={l.target.x} y2={l.target.y}
              stroke="var(--text-3)" strokeOpacity={inActive(l.source) ? 0.45 : 0.08} strokeWidth="1.5" />
          ))}
        </g>
        <g>
          {nodes.map((n) => {
            const on = inActive(n);
            const fill = on ? (n.type === "report" ? "var(--series-1)" : "var(--series-2)") : "var(--muted-node)";
            const common = {
              fill, stroke: "var(--surface)", strokeWidth: 2, style: { cursor: "pointer" },
              onMouseEnter: () => setTip(n), onMouseLeave: () => setTip(null),
              onClick: () => onSelect(n.type === "report" ? n.campaign : camOfIdent.get(n.id)),
            };
            const r = n.type === "report" ? 6 : 5 + Math.min(4, n.reporters || 1);
            return n.type === "report"
              ? <circle key={n.id} {...common} cx={n.x} cy={n.y} r={r} />
              : <rect key={n.id} {...common} x={n.x - r} y={n.y - r} width={r * 2} height={r * 2} rx={3} />;
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
