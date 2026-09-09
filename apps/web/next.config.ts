import type { NextConfig } from "next";

/**
 * Security headers.
 *
 * The Content Security Policy is unusually tight because this site is unusually simple.
 * There is no third-party script, no analytics, no error reporting, no external font and no
 * API of our own (ADR-0007, ADR-0008), so almost everything can be denied outright rather
 * than allowed with a shrug.
 *
 * `connect-src 'none'` is the interesting one. It tells the browser this page never makes a
 * network request, which is the same promise the homepage makes in words and
 * `apps/web/tests/rent-check.test.tsx` enforces in a test. Three layers saying the same
 * thing, and the browser's is the one an attacker cannot talk their way past: if a
 * dependency were ever compromised and tried to exfiltrate a rent figure, the CSP blocks it
 * even though the code shipped.
 *
 * `style-src` needs `'unsafe-inline'` because Next inlines critical CSS. That is a real
 * weakening and it is worth naming rather than hiding. Nonces would remove it, and they
 * require a middleware and a dynamic response, which would stop both pages being static.
 * On a site with no user input reaching a server and no third-party script, inline styles
 * are the smallest of the risks here.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Nothing on this site talks to a network. Say so to the browser as well as to the user.
  "connect-src 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@tenant/rules", "@tenant/cpi"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          // No referrer at all. A referrer on an outbound citation link would tell the
          // Law Reform Commission which page of a rent tool the reader came from.
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "interest-cohort=()",
            ].join(", "),
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default config;
