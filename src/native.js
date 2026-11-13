// Bridge to the Android side (android/app/src/main/java/.../SecondThoughtPlugin.java).
// In a normal browser everything here is a no-op, so the same UI still runs on the web.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { mockPlugin } from "./native_mock.js";

const MOCK = import.meta.env.VITE_MOCK_NATIVE === "1";  // screenshots/tests in a browser only
export const isNative = MOCK || Capacitor.isNativePlatform();
export const ST = MOCK ? mockPlugin() : registerPlugin("SecondThought");

export async function nativeStatus() {
  if (!isNative) return null;
  try { return await ST.status(); } catch { return null; }
}

export async function notify(title, body, route = "/", id) {
  if (!isNative) return false;
  try { await ST.notify({ title, body, route, id }); return true; } catch { return false; }
}

export async function shareText(text, title = "Share") {
  if (isNative) { await ST.share({ text, title }); return true; }
  if (navigator.share) { await navigator.share({ text, title }); return true; }
  return false;
}
