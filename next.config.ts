import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

// Origins the Google Tag Manager container needs, plus the Google tags it
// usually deploys (GA4). Any other vendor tag added inside the container later
// needs its own domains here, or the browser blocks it silently.
const gtmScriptSrc = "https://www.googletagmanager.com";
const gtmFrameSrc = "https://www.googletagmanager.com";
const gtmImgSrc =
  "https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com";
const gtmConnectSrc =
  "https://www.googletagmanager.com https://*.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
      {
        key: "Content-Security-Policy",
        value: [
          "default-src 'self'",
          `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"} ${gtmScriptSrc}`,
          "style-src 'self' 'unsafe-inline'",
          `img-src 'self' data: blob: ${gtmImgSrc}`,
          "font-src 'self' data:",
          `connect-src 'self' ${gtmConnectSrc}`,
          `frame-src 'self' ${gtmFrameSrc}`,
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join("; "),
      },
    ];

    if (isProduction) {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
