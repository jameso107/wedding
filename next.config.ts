import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor and some browsers open 127.0.0.1 / ::1, which Next otherwise
  // treats as cross-origin and serves a non-interactive page.
  // planning.localhost serves the private planning board in dev (see proxy.ts).
  allowedDevOrigins: ["127.0.0.1", "::1", "[::1]", "planning.localhost"],
};

export default nextConfig;
