export const DEFAULT_OG_IMAGE = "https://curiosity60seconds.com/og-default.png";

export function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function absoluteUrl(path: string) {
  const base = getAppBaseUrl().replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

export function stripMarkdownToText(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_~\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function descriptionFromMarkdown(input: string, max = 160) {
  const text = stripMarkdownToText(input);
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}…`;
}
