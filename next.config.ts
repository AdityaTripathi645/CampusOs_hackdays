import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  // Server actions handle PPT/PDF uploads; default body limit is 1 MB.
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
  // Native/Node-only packages stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "qrcode"],
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
