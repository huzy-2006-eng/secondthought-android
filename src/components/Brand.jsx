// Visual pieces of the app theme: glowing shield logo, verdict gauge, scanning dot grid.

export function GlowShield({ size = 240, mark = "check", ...rest }) {
  return (
    <svg viewBox="0 0 240 260" width={size} height={size * 260 / 240} aria-hidden="true" {...rest}>
      <defs>
        <linearGradient id="gs-a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#b45cff" /><stop offset="1" stopColor="#e0307a" /></linearGradient>
        <linearGradient id="gs-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" stopOpacity="0.55" /><stop offset="0.5" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
        <radialGradient id="gs-c" cx="0.5" cy="0.35" r="0.7"><stop offset="0" stopColor="#7b3bd6" /><stop offset="1" stopColor="#c02870" /></radialGradient>
      </defs>
      <path d="M120 6 228 46v74c0 70-46 118-108 134C58 238 12 190 12 120V46Z" fill="#ffffff" fillOpacity="0.05" stroke="#ffffff" strokeOpacity="0.12" />
      <path d="M120 28 206 60v60c0 56-36 94-86 108C70 214 34 176 34 120V60Z" fill="#ffffff" fillOpacity="0.06" stroke="#ffffff" strokeOpacity="0.14" />
      <path d="M120 50 184 74v46c0 42-27 70-64 81-37-11-64-39-64-81V74Z" fill="url(#gs-c)" stroke="url(#gs-a)" strokeWidth="4" />
      <path d="M120 54 180 76v22c-30 10-90 10-120 0V76Z" fill="url(#gs-b)" />
      {mark === "check"
        ? <path d="M92 126l20 20 38-44" fill="none" stroke="#fff" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
        : <text x="120" y="146" textAnchor="middle" fontSize="54" fontWeight="800" fill="#fff" fontFamily="system-ui, sans-serif">ST</text>}
    </svg>
  );
}

/** Semicircle gauge: coloured by how many checks were scam / suspicious / safe. */
export function VerdictGauge({ scam = 0, suspicious = 0, safe = 0, label }) {
  const total = scam + suspicious + safe;
  const r = 80, cx = 100, cy = 100, len = Math.PI * r;
  const segs = total
    ? [["#ff4d5e", scam], ["#ff8a3d", suspicious], ["#2fd27a", safe]]
    : [["#3a3446", 1]];
  let off = 0;
  const sum = total || 1;
  return (
    <svg className="gauge" viewBox="0 0 200 118" role="img" aria-label={label}>
      <path d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke="#2e2939" strokeWidth="22" strokeLinecap="round" />
      {segs.map(([c, v], i) => {
        const l = (v / sum) * len;
        const el = <path key={i} d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`} fill="none" stroke={c} strokeWidth="22"
          strokeDasharray={`${Math.max(0, l - (total ? 3 : 0))} ${len}`} strokeDashoffset={-off} />;
        off += l;
        return el;
      })}
    </svg>
  );
}

// deterministic "random" dot colours so the grid looks alive but never flickers between renders
const DOTS = Array.from({ length: 26 * 7 }, (_, i) => {
  const v = (Math.sin(i * 12.9898) * 43758.5453) % 1;
  const x = Math.abs(v);
  return x > 0.93 ? "#e0307a" : x > 0.88 ? "#5b8cff" : x > 0.84 ? "#ff8a3d" : x > 0.45 ? "#3a3446" : "#26212f";
});
export function DotScanner({ busy, children }) {
  return (
    <div className={`scanner ${busy ? "busy" : ""}`} aria-hidden="true">
      <div className="grid">{DOTS.map((c, i) => <i key={i} style={{ background: c }} />)}</div>
      <div className="bar" />
      <div className="core">{children}</div>
    </div>
  );
}
