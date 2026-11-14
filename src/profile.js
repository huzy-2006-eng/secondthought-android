// The user's profile and app-lock setting. Kept only on this phone: there is no account and nothing is uploaded.
import { store } from "./api.js";
export const getProfile = () => store.get("profile");
export const setProfile = (p) => store.set("profile", p);
export const lockEnabled = () => Boolean(getProfile()?.lock);
