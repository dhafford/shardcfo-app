import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zmfiywofguxhnyzfegdn.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  headers: async () => [
    {
      source: "/dashboard/:path*",
      headers: [
        {
          key: "X-Robots-Tag",
          value: "noindex, nofollow",
        },
      ],
    },
  ],
};

export default nextConfig;
