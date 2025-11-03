// next.config.ts
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      {
        protocol: "https",
        hostname: "**.firebasestorage.app",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
