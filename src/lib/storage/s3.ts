import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isValidKey } from "./key";
import type { StorageDriver } from "./index";

export type S3Config = { bucket: string; region: string; endpoint?: string; accessKeyId: string; secretAccessKey: string };

/** S3-compatible driver: AWS S3, Cloudflare R2, Supabase Storage (S3 endpoint), MinIO, ... */
export function s3Driver(cfg: S3Config): StorageDriver {
  const client = new S3Client({
    region: cfg.region,
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: !!cfg.endpoint, // R2/MinIO/Supabase want path-style
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
  });
  const check = (key: string) => {
    if (!isValidKey(key)) throw new Error("Invalid storage key.");
    return key;
  };
  return {
    name: "s3",
    async put(key, data, contentType) {
      await client.send(new PutObjectCommand({
        Bucket: cfg.bucket, Key: check(key), Body: data, ContentType: contentType,
        ServerSideEncryption: cfg.endpoint ? undefined : "AES256",
      }));
    },
    async get(key) {
      const r = await client.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: check(key) }));
      if (!r.Body) throw new Error("Empty object.");
      return r.Body.transformToByteArray();
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: check(key) }));
    },
  };
}
