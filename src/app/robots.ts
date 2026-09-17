import type { MetadataRoute } from "next";

// Deliberately does not list the admin URLs. robots.txt is a public file
// anyone can read at /robots.txt; a Disallow entry would hand out the exact
// path we don't want found. Nothing links to the admin pages from the public
// site, and every path outside the allowed admin segments already 404s (see
// src/lib/admin-routes.ts), so there is nothing here for a crawler to avoid.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/contact"],
      disallow: ["/api", "/thank-you"],
    },
  };
}
