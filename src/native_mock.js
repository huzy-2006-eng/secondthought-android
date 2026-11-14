// Used ONLY when building screenshots/tests with VITE_MOCK_NATIVE=1 (never in the APK):
// stands in for the Android plugin so the app's Android-only screens can be rendered in a browser.
const listeners = {};
export function mockPlugin() {
  const state = { sdk: 35, screeningSupported: true, screeningEnabled: false, unknownCallPrompt: true, notifications: false, smsSupported: true, smsRead: false, smsWatch: false };
  const emit = (ev, data) => (listeners[ev] || []).forEach((f) => f(data));
  window.__mockNative = { state, emit };
  return {
    status: async () => ({ ...state }),
    requestCallScreening: async () => { state.screeningEnabled = true; return { enabled: true }; },
    requestNotifications: async () => { state.notifications = true; return { granted: true }; },
    setUnknownCallPrompt: async ({ enabled }) => { state.unknownCallPrompt = enabled; return { unknownCallPrompt: enabled }; },
    notify: async (o) => { (window.__notifications = window.__notifications || []).push(o); },
    simulateIncomingCall: async () => { setTimeout(() => { location.hash = "/incoming?n=%2B910000000102&sim=1"; }, 300); },
    consumeLaunch: async () => window.__launch || ({}),
    share: async () => {},
    lockAvailable: async () => ({ available: true, biometric: true }),
    unlock: async () => { (window.__unlocks = (window.__unlocks || 0) + 1); return { ok: true }; },
    scanImage: async () => ({ text: "14:02 \u2022 VM-SB1INB\nDear Customer, your SBI YONO account will be suspended today. Update your PAN immediately at sbi-yono-kyc.example.com", script: "latin" }),
    readSharedImage: async () => ({ text: "Hi Mum, I dropped my phone, this is my new number. Can you help me pay a bill today?", script: "latin" }),
    requestSms: async () => { state.smsRead = true; state.smsWatch = true; return { read: true, receive: true, smsWatch: true }; },
    simulateSms: async (o) => { (window.__notifications = window.__notifications || []).push({ sms: true, ...o }); return { alert: true, code: "mobile_claim" }; },
    setSmsWatch: async ({ enabled }) => { state.smsWatch = enabled; return { smsWatch: enabled }; },
    recentSms: async () => {
      if (!state.smsRead) return { denied: true, messages: [] };
      const now = Date.now();
      return { messages: [
        { address: "+919820144517", body: "Dear Customer, your HDFC Bank relationship manager has changed. Please save this number for all future banking help.", date: now - 6e5 },
        { address: "VM-HDFCBK-S", body: "Dear Customer, Rs.500 debited from your HDFC Bank A/c XX1234 on 14-11-26. Not you? Call 18002586161", date: now - 36e5 },
        { address: "JD-1CICIB", body: "Dear customer, your ICICI netbanking is locked. Verify now: icici-unlock.example.com", date: now - 72e5 },
        { address: "+919876500000", body: "Running late, see you at 7", date: now - 9e6 },
      ] };
    },
    openUrl: async (o) => { (window.__opened = window.__opened || []).push(o.url); },
    sms: async (o) => { (window.__sms = window.__sms || []).push(o); },
    dial: async (o) => { (window.__dial = window.__dial || []).push(o); },
    addListener: (ev, f) => { (listeners[ev] = listeners[ev] || []).push(f); return Promise.resolve({ remove: () => { listeners[ev] = listeners[ev].filter((x) => x !== f); } }); },
  };
}
