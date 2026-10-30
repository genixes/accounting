import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { isValidKey } from "./key";
import type { StorageDriver } from "./index";

/** Dev/test driver. Writes under `root`; refuses any key that wasn't issued by storageKey(). */
export function localDriver(root: string): StorageDriver {
  const full = (key: string) => {
    if (!isValidKey(key)) throw new Error("Invalid storage key.");
    const p = path.resolve(root, key);
    if (!p.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage key.");
    return p;
  };
  return {
    name: "local",
    async put(key, data) {
      const p = full(key);
      await mkdir(path.dirname(p), { recursive: true });
      await writeFile(p, data);
    },
    async get(key) {
      return new Uint8Array(await readFile(full(key)));
    },
    async remove(key) {
      await rm(full(key), { force: true });
    },
  };
}
