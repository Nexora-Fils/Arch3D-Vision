const DEFAULT_PATH = "/dashboard";
const BASE = "http://homeplan.invalid";

/**
 * Where to go after login. Only same-site paths are kept: "//evil.example",
 * "/\evil.example" or an absolute URL would turn the form into an open redirect.
 */
export const safeNextPath = (value: string | null | undefined): string => {
  if (!value?.startsWith("/")) return DEFAULT_PATH;
  const url = new URL(value, BASE);
  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : DEFAULT_PATH;
};

export const loginPath = (next?: string): string => (next ? `/connexion?next=${encodeURIComponent(next)}` : "/connexion");
