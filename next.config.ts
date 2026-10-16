import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cursor and some browsers open 127.0.0.1 / ::1, which Next otherwise
  // treats as cross-origin and serves a non-interactive page.
  allowedDevOrigins: ["127.0.0.1", "::1", "[::1]"],
};

export default nextConfig;
