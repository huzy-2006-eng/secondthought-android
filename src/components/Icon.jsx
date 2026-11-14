// Minimal inline icon set (stroke icons, currentColor).
const P = {
  shield: <path d="M12 3 20 6v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10V6z" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></>,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-6 6.5-6s5.9 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14c2.6.2 4.4 2.3 5 5" /></>,
  graph: <><circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="7" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.3 7l9.4 0M6.3 8.2l4.6 7.6M17.7 9.2l-4.6 6.6" /></>,
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v4.5M12 17.5v.5" /></>,
  octagon: <><path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" /><path d="M12 8v5M12 16v.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  play: <path d="M7 5v14l12-7z" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  chat: <path d="M4 5h16v11H9l-5 4z" />,
  phoneOff: <><path d="M4 4l16 16" /><path d="M9.5 13.5C7.6 11.6 6.3 9.5 6 8l2-2-2.5-3L3 4.5C3 12 12 21 19.5 21l1.5-2.5-3-2.5-2 2c-.8-.2-1.8-.6-2.8-1.3" /></>,
  phone: <path d="M5 3l3 3.5-2 2c.8 2.6 3.9 5.7 6.5 6.5l2-2 3.5 3-1.5 3C9.5 19 5 14.5 3 5.5z" />,
  card: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></>,
  bot: <><rect x="5" y="8" width="14" height="11" rx="3" /><path d="M12 4v4M9 13v1M15 13v1" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  qr: <><rect x="4" y="4" width="6" height="6" /><rect x="14" y="4" width="6" height="6" /><rect x="4" y="14" width="6" height="6" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M4 16V4h12" /></>,
  volume: <><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: <><circle cx="12" cy="8" r="3.8" /><path d="M4.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5" /></>,
  inbox: <><path d="M3 13h5l1.5 3h5L16 13h5" /><path d="M5 5h14l2 8v6H3v-6z" /></>,
  external: <><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v6H4V6h6" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
};

export default function Icon({ name, title, ...rest }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"} role={title ? "img" : undefined} {...rest}>
      {title ? <title>{title}</title> : null}
      {P[name] || null}
    </svg>
  );
}
