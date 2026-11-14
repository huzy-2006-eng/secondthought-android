import { readFile } from "node:fs/promises";
const dir = new URL("../public/engine/", import.meta.url);
export const nodeLoader = {
  text: (n) => readFile(new URL(n, dir), "utf8"),
  binary: async (n) => { const b = await readFile(new URL(n, dir)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
};
