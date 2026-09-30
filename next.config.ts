import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  experimental: {
    // Одна картинка за вызов: обложки до 5 МБ, снимки скороговорок до 8 МБ,
    // плюс запас под поля multipart-формы. Пачку скороговорок страница
    // отправляет по одной, чтобы в запрос не летели десятки мегабайт разом.
    serverActions: { bodySizeLimit: "12mb" },
  },
};

export default nextConfig;
