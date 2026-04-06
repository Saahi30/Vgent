import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: monorepoRoot,
  webpack: (config, { isServer }) => {
    // Prevent Webpack from snapshotting directories outside the monorepo
    // (fixes freeze caused by ~/node_modules + ~/package-lock.json)
    config.snapshot = {
      managedPaths: [join(monorepoRoot, "node_modules")],
      immutablePaths: [],
      buildDependencies: { hash: true, timestamp: true },
      module: { timestamp: true },
      resolve: { timestamp: true },
    };
    return config;
  },
};

export default nextConfig;
