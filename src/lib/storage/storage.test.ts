import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { detectType, isValidKey, safeName, storageKey } from "./key";
import { localDriver } from "./local";
import { getStorage } from "./index";

const bytes = (...n: number[]) => new Uint8Array(n);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0);

test("type detection trusts bytes, not the filename", () => {
  assert.equal(detectType(PDF, "x.pdf"), "pdf");
  assert.equal(detectType(PDF, "evil.exe"), "pdf"); // detected type wins; name is discarded
  assert.equal(detectType(PNG, "a.png"), "png");
  assert.equal(detectType(bytes(0xff, 0xd8, 0xff, 0xe0), "a.jpg"), "jpg");
  assert.equal(detectType(bytes(0x4d, 0x5a, 0x90, 0), "setup.pdf"), null); // Windows exe renamed to .pdf
  assert.equal(detectType(new TextEncoder().encode("<html><script>alert(1)</script>"), "a.html"), null);
  assert.equal(detectType(new TextEncoder().encode("a,b\n1,2\n"), "t.csv"), "csv");
  assert.equal(detectType(bytes(0, 1, 2, 3), "t.txt"), null); // binary pretending to be text
  assert.equal(detectType(bytes(0x50, 0x4b, 0x03, 0x04), "lease.docx"), "docx");
  assert.equal(detectType(bytes(0x50, 0x4b, 0x03, 0x04), "x.zip"), null);
});

test("filenames are sanitized and keys are tenant-scoped, server-generated", () => {
  assert.equal(safeName("..\\..\\etc/passwd"), "passwd");
  assert.equal(safeName('a"b<c>.pdf'), "abc.pdf");
  assert.equal(safeName("   "), "document");
  assert.equal(safeName("x".repeat(500)).length, 120);
  const k = storageKey("ten1", "prop1", "pdf");
  assert.match(k, /^ten1\/prop1\/[0-9a-f-]{36}\.pdf$/);
  assert.ok(isValidKey(k));
  assert.ok(!isValidKey("../x/y/z.pdf"));
  assert.ok(!isValidKey("ten1/prop1/../../etc.pdf"));
  assert.ok(!isValidKey("a/b/c d.pdf"));
});

test("local driver round-trips and refuses traversal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "stor-"));
  const d = localDriver(dir);
  const key = storageKey("t", "p", "pdf");
  await d.put(key, PDF, "application/pdf");
  assert.deepEqual([...(await d.get(key))], [...PDF]);
  await d.remove(key);
  await assert.rejects(d.get(key));
  await assert.rejects(d.put("../../escape/x.pdf", PDF, "application/pdf"), /Invalid storage key/);
  assert.deepEqual(await readdir(dir).then((x) => x.length > 0), true);
});

test("storage config: production without a bucket fails loudly", () => {
  assert.throws(() => getStorage({ NODE_ENV: "production" }), /not configured/);
  assert.throws(() => getStorage({ STORAGE_BUCKET: "b" }), /ACCESS_KEY/);
  assert.equal(getStorage({ NODE_ENV: "development", STORAGE_LOCAL_DIR: os.tmpdir() }).name, "local");
  assert.equal(getStorage({ STORAGE_BUCKET: "b", STORAGE_ACCESS_KEY_ID: "a", STORAGE_SECRET_ACCESS_KEY: "s" }).name, "s3");
});
