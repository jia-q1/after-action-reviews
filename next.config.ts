import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // proxy.ts (added for the access-code gate) buffers every matched
    // request's body in memory so it can be read again downstream;
    // Next.js caps that buffer at 10MB by default and silently
    // truncates anything larger -- which corrupts JSON mid-string and
    // surfaces as an unhelpful 500 in the route handler, not a clear
    // error at the source. Most documents go through Blob storage now,
    // not inline, but the inline fallback path and large multi-document
    // test payloads can still exceed 10MB.
    proxyClientMaxBodySize: "100mb",
  },
};

export default nextConfig;
