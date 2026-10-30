import path from "node:path";
import { localDriver } from "./local";
import { s3Driver } from "./s3";

export interface StorageDriver {
  name: "local" | "s3";
  put(key: string, data: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

let cached: StorageDriver | null = null;

/** S3-compatible when STORAGE_BUCKET is set. Local disk only outside production:
 *  a production deploy without a bucket must fail loudly, not write to an
 *  ephemeral disk and lose customers' legal documents. */
export function getStorage(env: Record<string, string | undefined> = process.env): StorageDriver {
  if (cached && env === process.env) return cached;
  let d: StorageDriver;
  if (env.STORAGE_BUCKET) {
    const { STORAGE_REGION, STORAGE_ENDPOINT, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY } = env;
    if (!STORAGE_ACCESS_KEY_ID || !STORAGE_SECRET_ACCESS_KEY) throw new Error("STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY are required with STORAGE_BUCKET.");
    d = s3Driver({
      bucket: env.STORAGE_BUCKET, region: STORAGE_REGION || "auto", endpoint: STORAGE_ENDPOINT,
      accessKeyId: STORAGE_ACCESS_KEY_ID, secretAccessKey: STORAGE_SECRET_ACCESS_KEY,
    });
  } else if (env.NODE_ENV === "production") {
    throw new Error("Document storage is not configured: set STORAGE_BUCKET (and credentials) in production.");
  } else {
    d = localDriver(env.STORAGE_LOCAL_DIR || path.join(process.cwd(), ".data", "uploads"));
  }
  if (env === process.env) cached = d;
  return d;
}
