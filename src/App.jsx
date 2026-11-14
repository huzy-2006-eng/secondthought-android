import { useEffect, useState } from "react";
import { api, store } from "./api.js";
import Icon from "./components/Icon.jsx";
import { LANGS, LangContext, translate } from "./i18n.js";
import { isNative, ST } from "./native.js";
import { getEngine } from "./engine/browser.js";
import { SessionProvider, useSession } from "./session.jsx";
import Checker from "./pages/Checker.jsx";
import Family from "./pages/Family.jsx";
import Graph from "./pages/Graph.jsx";
import Guardian from "./pages/Guardian.jsx";
import Home from "./pages/Home.jsx";
import Honeypot from "./pages/Honeypot.jsx";
import Incoming from "./pages/Incoming.jsx";
import More from "./pages/More.jsx";
import Pay from "./pages/Pay.jsx";
import Report from "./pages/Report.jsx";
import Setup from "./pages/Setup.jsx";
import Welcome from "./pages/Welcome.jsx";
import Shield from "./pages/Shield.jsx";

function useHashRoute() {
  const read = () => (location.hash.replace(/^#/, "") || "/");
  const [path, setPath] = useState(read);
  useEffect(() => {
    const on = () => { setPath(read()); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return [path, (p) => { location.hash = p; }];
}

// Four big tabs. Everything from the web version is still here, under "More".
const NAV = [
  { path: "/", icon: "shield", key: "nav_home", match: ["", "protect", "pay", "honeypot", "report", "incoming"] },
  { path: "/check", icon: "search", key: "nav_check", match: ["check"] },
  { path: "/family", icon: "users", key: "nav_family", match: ["family"] },
  { path: "/more", icon: "menu", key: "nav_more", match: ["more", "guardian", "intel", "setup"] },
];

function Shell({ lang, setLang, large, setLarge }) {
  const [path, go] = useHashRoute();
  const [online, setOnline] = useState(null);
  const [shared, setShared] = useState(null);
  const s = useSession();
  const t = (k, v) => translate(lang, k, v);

  // Load the on-device detection engine in the background as soon as the app opens.
  useEffect(() => { const t = setTimeout(() => getEngine().catch(() => {}), 300); return () => clearTimeout(t); }, []);

  // The free server sleeps when idle; keep trying quietly until it answers.
  useEffect(() => {
    let stop = false, timer;
    const ping = () => api.health().then(() => !stop && setOnline(true))
      .catch(() => { if (!stop) { setOnline(false); timer = setTimeout(ping, 5000); } });
    ping();
    return () => { stop = true; clearTimeout(timer); };
  }, []);

  // First run → setup. Notification taps and "Share to SecondThought" → the right screen.
  useEffect(() => {
    if (!store.get("setupDone") && !location.hash.startsWith("#/incoming")) go("/welcome");
    if (!isNative) return;
    const open = (l) => {
      if (!l || !l.route) return;
      if (l.text) setShared({ text: l.text, at: Date.now() });
      if (l.image) setShared({ image: l.image, at: Date.now() });
      go(l.route);
    };
    ST.consumeLaunch().then(open).catch(() => {});
    const sub = ST.addListener("launch", open);
    return () => { sub.then((h) => h.remove()).catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [rawPath, qs = ""] = path.split("?");
  const query = new URLSearchParams(qs);
  const [, base, arg] = rawPath.match(/^\/([^/]*)\/?(.*)$/) || [];
  const wide = base === "intel";

  let page;
  switch (base) {
    case "check": page = <Checker key={shared?.at || 0} initialText={shared?.text} initialImage={shared?.image} go={go} />; break;
    case "family": page = <Family go={go} />; break;
    case "more": page = <More go={go} />; break;
    case "welcome": page = <Welcome go={go} />; break;
    case "setup": page = <Setup go={go} lang={lang} setLang={setLang} large={large} setLarge={setLarge} />; break;
    case "incoming": page = <Incoming key={qs} query={query} go={go} />; break;
    case "protect": page = <Shield go={go} query={query} />; break;
    case "guardian": page = <Guardian code={arg || null} go={go} />; break;
    case "intel": page = <Graph />; break;
    case "pay": page = <Pay go={go} />; break;
    case "honeypot": page = <Honeypot go={go} />; break;
    case "report": page = <Report go={go} />; break;
    default: page = <Home go={go} online={online} />;
  }

  if (base === "welcome") return <div className="app"><main>{page}</main></div>;

  return (
    <div className="app">
      <header className="topbar">
        {base ? (
          <button className="back" onClick={() => history.length > 1 ? history.back() : go("/")} aria-label="Back"><span aria-hidden="true">‹</span></button>
        ) : null}
        <a className="brand" href="#/"><img src="/icon.svg" alt="" />SecondThought</a>
        <span className="spacer" />
        {online === false ? <span className="pill" title="Connecting to the server">offline</span> : null}
        <select value={lang} onChange={(e) => setLang(e.target.value)} aria-label="Language">
          {LANGS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </header>
      {s.sessionId && ["call", "simulated"].includes(s.channel) && base !== "protect" && !["pay", "honeypot", "report"].includes(base) ? (
        <a href="#/protect" className="banner info" style={{ margin: "10px 16px 0", textDecoration: "none", color: "inherit" }}>
          <Icon name="shield" />Protected call in progress · risk {s.snap?.score ?? 0}/100. Tap to return.
        </a>
      ) : null}
      <main className={wide ? "wide" : ""}>{page}</main>
      <nav className="nav big" aria-label="Main">
        {NAV.map((n) => {
          const active = n.match.includes(base || "");
          return (
            <a key={n.path} href={`#${n.path}`} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon name={n.icon} />{t(n.key)}
            </a>
          );
        })}
      </nav>
    </div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(() => store.get("lang", "en"));
  const [large, setLargeState] = useState(() => store.get("large", false));
  const setLang = (l) => { setLangState(l); store.set("lang", l); document.documentElement.lang = l; };
  const setLarge = (v) => { setLargeState(v); store.set("large", v); };
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { document.documentElement.classList.toggle("large", Boolean(large)); }, [large]);
  return (
    <LangContext.Provider value={lang}>
      <SessionProvider>
        <Shell lang={lang} setLang={setLang} large={large} setLarge={setLarge} />
      </SessionProvider>
    </LangContext.Provider>
  );
}
