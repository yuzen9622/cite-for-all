import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@citation-js/core",
    "@citation-js/plugin-bibtex",
    "@citation-js/plugin-csl",
    "citeproc",
  ],
  outputFileTracingIncludes: {
    "/api/cite": [
      "./src/lib/citation-engine/styles/**/*.csl",
      "./src/lib/citation-engine/locales/**/*.xml",
    ],
  },
};

export default nextConfig;
