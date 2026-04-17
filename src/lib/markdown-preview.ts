/** Strip common Markdown for a plain-text preview (best-effort). */
export function stripMarkdownForPreview(markdown: string, maxChars: number): string {
  const s = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (s.length <= maxChars) {
    return s;
  }
  return `${s.slice(0, maxChars).trimEnd()}…`;
}
