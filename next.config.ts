import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Обложки до 5 МБ + небольшой запас под поля multipart-формы.
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
