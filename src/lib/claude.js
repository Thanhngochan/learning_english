const ENDPOINT = "/api/claude";
const MODEL = import.meta.env.VITE_CLAUDE_MODEL || "claude-sonnet-4-6";

/** Ask Claude; with `search` it may use the web search tool. Returns the answer text. */
export async function askClaude(prompt, { search = false, maxTokens = 1500 } = {}) {
  const body = { model: MODEL, max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] };
  if (search) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }];
  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("Cannot reach the Claude endpoint. Check your connection and that the app is running.");
  }
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).error?.message || ""; } catch (e) { /* no body */ }
    const hint = {
      401: "API key missing or invalid. Put ANTHROPIC_API_KEY in .env and restart npm run dev.",
      403: "This API key is not allowed to do this.",
      404: "No /api/claude route. Start the app with npm run dev or npm start.",
      429: "Rate limit reached. Wait a minute and try again.",
    }[res.status] || "Claude API error " + res.status + ".";
    throw new Error(detail ? hint + " Details: " + detail : hint);
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

/** Pull the first JSON array out of a model reply. */
export function parseJSONArray(text) {
  const clean = text.replace(/```json|```/g, "");
  const a = clean.search(/\[\s*\{/);
  if (a < 0) throw new Error("Claude replied without a list. Try a more specific topic in English.");
  const body = clean.slice(a);
  try {
    return JSON.parse(body.slice(0, body.lastIndexOf("]") + 1));
  } catch (e) {
    // Reply was cut off: keep the items that arrived complete.
    const cut = body.lastIndexOf("}");
    if (cut < 0) throw new Error("Claude's reply was cut off. Try again.");
    return JSON.parse(body.slice(0, cut + 1) + "]");
  }
}
