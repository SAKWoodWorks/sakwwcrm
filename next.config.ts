import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  output: "standalone",
  // execFile with a dynamic python path makes the file tracer treat the whole
  // project as a dependency — keep heavy non-runtime dirs out of standalone output
  outputFileTracingExcludes: {
    "*": ["./docs/**", "./extraction/**", "./.superpowers/**"],
  },
  // 16.3: one loading shell per route instead of one prefetch per link
  cacheComponents: true,
  partialPrefetching: true,
  // 16.3: React Compiler auto-memoization at build time
  reactCompiler: true,
  experimental: {
    proxyClientMaxBodySize: 100 * 1024 * 1024,
    // 16.3: Rust-based React Compiler — skips Babel round-trip, ~34-46% faster cold/warm dev start
    turbopackRustReactCompiler: true,
    // 16.3: keep pending on network drop, retry on reconnect
    useOffline: true,
  },
};

export default withNextIntl(nextConfig);
