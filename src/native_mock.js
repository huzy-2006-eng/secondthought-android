// Used ONLY when building screenshots/tests with VITE_MOCK_NATIVE=1 (never in the APK):
// stands in for the Android plugin so the app's Android-only screens can be rendered in a browser.
const listeners = {};
export function mockPlugin() {
  const state = { sdk: 35, screeningSupported: true, screeningEnabled: false, unknownCallPrompt: true, notifications: false };
  const emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));
  window.__mockNative = { state, emit };
  return {
    status: async () => ({ ...state }),
    requestCallScreening: async () => { state.screeningEnabled = true; return { enabled: true }; },
    requestNotifications: async () => { state.notifications = true; return { granted: true }; },
    setUnknownCallPrompt: async ({ enabled }) => { state.unknownCallPrompt = enabled; return { unknownCallPrompt: enabled }; },
    notify: async (o) => { (window.__notifications = window.__notifications || []).push(o); },
    simulateIncomingCall: async () => { setTimeout(() => { location.hash = "/incoming?n=%2B910000000102&sim=1"; }, 300); },
    consumeLaunch: async () => ({}),
    share: async () => {},
    openUrl: async (o) => { (window.__opened = window.__opened || []).push(o.url); },
    sms: async (o) => { (window.__sms = window.__sms || []).push(o); },
    dial: async (o) => { (window.__dial = window.__dial || []).push(o); },
    addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); return Promise.resolve({ remove: () => { listeners[ev] = listeners[ev].filter((x) => x !== f); } }); },
  };
}
