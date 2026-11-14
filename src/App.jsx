import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
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
import Profile from "./pages/Profile.jsx";
import Caregiver from "./pages/Caregiver.jsx";
import Splash from "./components/Splash.jsx";
import LockScreen from "./components/LockScreen.jsx";
import { getProfile, lockEnabled } from "./profile.js";
import Shield from "./pages/Shield.jsx";

const TAB_BASES = new Set(["", "check", "family", "more"]);
const baseOf = (p) => (p.split("?")[0].match(/^\/([^/]*)/) || [, ""])[1];
const calmMotion = () => { try { return Boolean(window.__noMotion) || window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } };   // __noMotion: automated tests only

// Hash router with smooth screen transitions: forward slides in from the right, back from the left,
// switching bottom tabs cross-fades. Uses the View Transitions API when the WebView has it.
function useHashRoute() {
  const read = () => (location.hash.replace(/^#/, "") || "/");
  const [path, setPath] = useState(read);
  const stack = useRef([read()]);
  const running = useRef(false);
  useEffect(() => {
    const on = () => {
      const next = read();
      const st = stack.current;
      const prev = st[st.length - 1];
      let dir = "forward";
      if (st.length > 1 && st[st.length - 2] === next) { dir = "back"; st.pop(); }
      else { st.push(next); if (st.length > 40) st.shift(); }
      if (dir !== "back" && TAB_BASES.has(baseOf(prev)) && TAB_BASES.has(baseOf(next)) && baseOf(prev) !== baseOf(next)) dir = "tab";
      document.documentElement.dataset.nav = dir;
      const apply = () => { setPath(next); window.scrollTo(0, 0); };
      // One transition at a time: if one is still running (fast taps), switch straight away.
      if (document.startViewTransition && !calmMotion() && !running.current && document.visibilityState === "visible") {
        running.current = true;
        document.documentElement.dataset.vt = "1";
        const vt = document.startViewTransition(() => flushSync(apply));
        const done = () => { running.current = false; delete document.documentElement.dataset.vt; };
        vt.finished.then(done, done);
        vt.ready.catch(() => {});
        vt.updateCallbackDone.catch(() => {});
      } else apply();
    };
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
  // Opening splash on every fresh launch (skipped when an unknown call opened the app: that screen is urgent).
  const urgentStart = location.hash.startsWith("#/incoming");
  const [splash, setSplash] = useState(urgentStart || window.__noSplash ? "off" : "on");   // __noSplash: automated tests only
  useEffect(() => {
    if (splash !== "on") return undefined;
    const a = setTimeout(() => setSplash("leaving"), 1500), b = setTimeout(() => setSplash("off"), 1850);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Keyboard open (the screen got much shorter): hide the bottom tab bar so it doesn't sit on the keyboard.
  useEffect(() => {
    let full = window.innerHeight;
    const on = () => {
      const h = window.innerHeight;
      if (h > full) full = h;
      document.documentElement.classList.toggle("kb-open", h < full * 0.78);
    };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);

  // App lock: asked after the splash, and again if the app was in the background for more than 2 minutes.
  const [locked, setLocked] = useState(() => lockEnabled());
  useEffect(() => {
    let hiddenAt = 0;
    const on = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && lockEnabled() && Date.now() - hiddenAt > 120000) setLocked(true);
    };
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);
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
      if (l.text) setShared({ text: l.text, sender: l.sender, at: Date.now() });
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
    case "check": page = <Checker key={shared?.at || 0} initialText={shared?.text} initialSender={shared?.sender} initialImage={shared?.image} go={go} />; break;
    case "family": page = <Family go={go} />; break;
    case "more": page = <More go={go} />; break;
    case "welcome": page = <Welcome go={go} />; break;
    case "profile": page = <Profile go={go} editing={Boolean(getProfile() && store.get("setupDone"))} next="/setup" setLarge={setLarge} />; break;
    case "caregiver": page = <Caregiver go={go} />; break;
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

  const overlay = (
    <>
      {splash !== "off" ? <Splash leaving={splash === "leaving"} /> : null}
      {splash === "off" && locked && base !== "incoming" ? <LockScreen name={getProfile()?.name} onUnlock={() => setLocked(false)} /> : null}
    </>
  );
  if (base === "welcome" || base === "profile" || base === "caregiver") return <div className="app"><main className="bare">{page}</main>{overlay}</div>;

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
      <main className={`${wide ? "wide " : ""}page-anim`} key={rawPath}>{page}</main>
      {overlay}
      <nav className="nav big" aria-label="Main">
        {NAV.map((n) => {
          const active = n.match.includes(base || "");
          return (
            <a key={n.path} href={`#${n.path}`} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
              <Icon name={n.icon} key={active ? "on" : "off"} />{t(n.key)}
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
