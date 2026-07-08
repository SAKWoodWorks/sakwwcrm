import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  output: "standalone",
  // execFile with a dynamic python path makes the file tracer treat the whole
  // project as a dependency — keep heavy non-runtime dirs out of standalone output
  outputFileTracingExcludes: {
    "*": ["./docs/**", "./extraction/**", "./.superpowers/**"],
  },
  experimental: {
    proxyClientMaxBodySize: 100 * 1024 * 1024,
  },
};

export default withNextIntl(nextConfig);
