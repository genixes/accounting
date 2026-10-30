/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Document uploads go through a server action; the default 1MB cap is
    // below the 10MB per-file limit enforced in src/lib/storage/key.ts.
    serverActions: { bodySizeLimit: "11mb" },
  },
};

export default nextConfig;
