// Canonical public origin of the app.
//
// Google OAuth requires the `redirect_uri` to EXACTLY match a registered URI,
// and the same value must be used both when starting the flow and when
// exchanging the code. On Vercel, `new URL(request.url).origin` reflects the
// internal/proxied request (often `http://` or a deployment-specific host), not
// the https domain the user is actually browsing — which triggers
// `redirect_uri_mismatch`. We instead trust the forwarded headers, with an
// explicit env override for a fully deterministic value across deployments.
export function siteOrigin(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `${proto}://${host}`;

  return new URL(request.url).origin;
}
