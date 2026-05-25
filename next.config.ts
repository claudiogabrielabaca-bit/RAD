import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

const TURNSTILE_ORIGINS = ["https://challenges.cloudflare.com"];
const CLOUDFLARE_ANALYTICS_ORIGINS = [
  "https://static.cloudflareinsights.com",
  "https://cloudflareinsights.com",
];
const WIKIMEDIA_IMAGE_ORIGINS = [
  "https://upload.wikimedia.org",
  "https://commons.wikimedia.org",
  "https://*.wikimedia.org",
];

const cspDirectives = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ""}${[
    ...TURNSTILE_ORIGINS,
    ...CLOUDFLARE_ANALYTICS_ORIGINS,
  ].join(" ")}`,
  `script-src-elem 'self' 'unsafe-inline' ${[
    ...TURNSTILE_ORIGINS,
    ...CLOUDFLARE_ANALYTICS_ORIGINS,
  ].join(" ")}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${WIKIMEDIA_IMAGE_ORIGINS.join(" ")}`,
  "font-src 'self' data:",
  `connect-src 'self' ${isDev ? "ws: wss: " : ""}${[
    ...TURNSTILE_ORIGINS,
    ...CLOUDFLARE_ANALYTICS_ORIGINS,
  ].join(" ")}`,
  `frame-src 'self' ${TURNSTILE_ORIGINS.join(" ")}`,
  `child-src 'self' ${TURNSTILE_ORIGINS.join(" ")}`,
  "media-src 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  isDev ? "" : "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "commons.wikimedia.org",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "off",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
