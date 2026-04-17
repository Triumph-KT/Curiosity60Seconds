import slugify from "slugify";
import type { AppUser } from "@/lib/types";

type PromptInput = {
  question: string;
  rawSources: string;
  imageEntries: Array<{ url: string; caption: string; sourceLabel: string }>;
};

function buildPrompt(input: PromptInput) {
  const imageBlock = input.imageEntries
    .map(
      (img) =>
        `- URL: ${img.url}\n  Caption: ${img.caption}\n  Source label: ${img.sourceLabel}`,
    )
    .join("\n");

  return `Question:\n${input.question}\n\nRaw sources:\n${input.rawSources}\n\nImages:\n${imageBlock}\n\nReturn complete Markdown with a title on the first line (# Title), structured sections, inline image markdown ![caption - source label](url), and a final "## Citations" section that cites all sources and images.`;
}

export async function generateVoicePrompt(params: {
  writingSamples: string[];
  preferences: string;
}) {
  const system =
    "You turn writing samples into a compact personal writing system prompt.";
  const userPrompt = `Writing samples:\n${params.writingSamples.join(
    "\n\n---\n\n",
  )}\n\nPreferences:\n${params.preferences}\n\nOutput only a concise first-person voice prompt.`;
  try {
    return await callClaude(system, userPrompt);
  } catch {
    return await callOllama(`${system}\n\n${userPrompt}`);
  }
}

async function callClaude(system: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.CLAUDE_MODEL ?? "claude-3-5-sonnet-latest",
      max_tokens: 2500,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude error: ${response.status} - ${errBody}`);
  }

  const json = (await response.json()) as {
    content: Array<{ type: string; text?: string }>;
  };

  const text = json.content.find((c) => c.type === "text")?.text?.trim();
  if (!text) throw new Error("Claude returned empty response");
  return text;
}

async function callOllama(prompt: string): Promise<string> {
  const endpoint = process.env.OLLAMA_ENDPOINT ?? "http://localhost:11434/api/generate";
  const model = process.env.OLLAMA_MODEL ?? "llama3.1";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status}`);
  }

  const json = (await res.json()) as { response?: string };
  return (
    json.response?.trim() ??
    "# Untitled\n\nNo model output was returned.\n\n## Citations\n\n- No citations generated."
  );
}

export async function generatePostMarkdown(params: {
  user: AppUser;
  input: PromptInput;
  useClaude: boolean;
}) {
  const prompt = buildPrompt(params.input);
  const system = params.user.voice_prompt ?? "Write clearly and with citations.";

  let markdown = "";
  if (params.useClaude) {
    markdown = await callClaude(system, prompt);
  } else {
    markdown = await callOllama(`${system}\n\n${prompt}`);
  }

  const firstHeading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? "Untitled";
  return {
    markdown,
    title: firstHeading,
    slug: slugify(firstHeading, { lower: true, strict: true }),
  };
}
