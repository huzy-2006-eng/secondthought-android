// The app version shown in More, taken from package.json (kept equal to versionName in android/app/build.gradle).
import pkg from "../package.json";
export const APP_VERSION = pkg.version;
