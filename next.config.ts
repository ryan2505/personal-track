import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Un package-lock.json traîne dans C:\Users\kount\ : sans cette ligne,
  // Turbopack remonte jusque-là et prend la mauvaise racine.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
