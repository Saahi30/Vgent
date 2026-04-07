import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  webpack: (config) => {
    config.snapshot = {
      managedPaths: [join(monorepoRoot, "node_modules")],
      immutablePaths: [],
      buildDependencies: { hash: true, timestamp: true },
      module: { timestamp: true },
      resolve: { timestamp: true },
    };
    config.watchOptions = {
      ignored: ["**/node_modules/**", "**/.next/**", "**/.git/**"],
      poll: 1000,
      aggregateTimeout: 500,
    };
    // Prevent module resolution from walking up to ~/node_modules
    config.resolve = {
      ...config.resolve,
      modules: [
        join(__dirname, "node_modules"),
        join(monorepoRoot, "node_modules"),
        "node_modules",
      ],
      symlinks: false,
    };
    return config;
  },
};

export default nextConfig;
