// eleeth-x402-mcp — MCP server for x402.eleeth.com
// 34 pay-per-call x402 v2 APIs (USDC on Base mainnet). No signup, no API key:
// the payment is the credential. The caller's Base private key comes from the
// ELEETH_X402_KEY env var; each tool call 402s, signs, and retries automatically.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";
import { z } from "zod";

const BASE = "https://x402.eleeth.com";
const NETWORK = "eip155:8453"; // Base mainnet

// ---------- payment ----------
let paidFetch: typeof fetch | null = null;

function getPaidFetch(): typeof fetch {
  if (paidFetch) return paidFetch;
  const key = process.env.ELEETH_X402_KEY;
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key.trim())) {
    throw new Error(
      "ELEETH_X402_KEY is not set (or not a 0x-prefixed 32-byte hex private key). " +
        "Set it to a Base wallet private key holding a little USDC — e.g. export ELEETH_X402_KEY=0x... — " +
        "then call the tool again. No signup or API key exists; the USDC payment is the credential."
    );
  }
  const account = privateKeyToAccount(key.trim() as `0x${string}`);
  paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: NETWORK, client: new ExactEvmScheme(account) }],
  });
  return paidFetch;
}

// ---------- tool table ----------
type Param = { name: string; type: "string" | "number"; required: boolean; desc: string };
type ToolDef = {
  name: string;
  desc: string; // includes price
  method: "GET" | "POST";
  path: string;
  params: Param[];
  binary?: "image/png";
  jobType?: "media" | "box"; // async: returns a job ticket
  validate?: (args: Record<string, unknown>) => string | null;
};

const P = (name: string, type: "string" | "number", required: boolean, desc: string): Param => ({
  name, type, required, desc,
});

const TOOLS: ToolDef[] = [
  { name: "x402_search", desc: "Web search for AI agents ($0.01 USDC/call). Returns titles, URLs, snippets.", method: "POST", path: "/api/search", params: [P("query", "string", true, "Search query"), P("num_results", "number", false, "How many results (default 5)")] },
  { name: "x402_read", desc: "Fetch any web page and return its clean article text ($0.01 USDC/call).", method: "POST", path: "/api/read", params: [P("url", "string", true, "Page URL")] },
  { name: "x402_chat", desc: "AI chat completion ($0.02 USDC/call).", method: "POST", path: "/api/chat", params: [P("message", "string", true, "The message/prompt")] },
  { name: "x402_image", desc: "AI image generation — returns a PNG image ($0.05 USDC/call).", method: "POST", path: "/api/image", params: [P("prompt", "string", true, "Image prompt")], binary: "image/png" },
  { name: "x402_crypto", desc: "Live crypto price + 24h change in USD ($0.01 USDC/call).", method: "GET", path: "/api/crypto", params: [P("coin", "string", false, "Coin id, e.g. 'bitcoin' (default bitcoin)")] },
  { name: "x402_weather", desc: "Current conditions + today's forecast ($0.01 USDC/call).", method: "GET", path: "/api/weather", params: [P("city", "string", true, "City name")] },
  { name: "x402_stock", desc: "Stock quote ($0.01 USDC/call).", method: "GET", path: "/api/stock", params: [P("ticker", "string", true, "Ticker, e.g. AAPL")] },
  { name: "x402_fx", desc: "Currency conversion; omit 'to' for the full table ($0.01 USDC/call).", method: "GET", path: "/api/fx", params: [P("from", "string", false, "Source currency, e.g. USD"), P("to", "string", false, "Target currency, e.g. MXN")] },
  { name: "x402_news", desc: "Latest news headlines ($0.01 USDC/call).", method: "GET", path: "/api/news", params: [P("q", "string", true, "News query")] },
  { name: "x402_dns", desc: "DNS records lookup ($0.01 USDC/call).", method: "GET", path: "/api/dns", params: [P("domain", "string", true, "Domain"), P("type", "string", false, "Record type, e.g. A (default A)")] },
  { name: "x402_wayback", desc: "Closest archived snapshot of a URL from archive.org ($0.01 USDC/call).", method: "GET", path: "/api/wayback", params: [P("url", "string", true, "URL to look up")] },
  { name: "x402_rss", desc: "Fetch any RSS/Atom feed and return it as JSON ($0.01 USDC/call).", method: "GET", path: "/api/rss", params: [P("url", "string", true, "Feed URL")] },
  { name: "x402_summarize", desc: "AI summary of any article URL ($0.02 USDC/call).", method: "GET", path: "/api/summarize", params: [P("url", "string", true, "Article URL")] },
  { name: "x402_whois", desc: "Domain WHOIS via RDAP ($0.01 USDC/call).", method: "GET", path: "/api/whois", params: [P("domain", "string", true, "Domain")] },
  { name: "x402_certs", desc: "Discover subdomains from certificate-transparency logs ($0.01 USDC/call).", method: "GET", path: "/api/certs", params: [P("domain", "string", true, "Domain")] },
  { name: "x402_seo", desc: "Instant SEO audit of a URL with a score ($0.02 USDC/call).", method: "GET", path: "/api/seo", params: [P("url", "string", true, "URL to audit")] },
  { name: "x402_github", desc: "GitHub repo stats ($0.01 USDC/call).", method: "GET", path: "/api/github", params: [P("repo", "string", true, "owner/name")] },
  { name: "x402_arxiv", desc: "Research paper search on arXiv ($0.01 USDC/call).", method: "GET", path: "/api/arxiv", params: [P("q", "string", true, "Query"), P("n", "number", false, "Max results (default 5)")] },
  { name: "x402_wiki", desc: "Wikipedia summary ($0.01 USDC/call).", method: "GET", path: "/api/wiki", params: [P("topic", "string", true, "Topic")] },
  { name: "x402_sec", desc: "SEC company financial facts ($0.01 USDC/call).", method: "GET", path: "/api/sec", params: [P("ticker", "string", true, "Ticker, e.g. AAPL")] },
  { name: "x402_feargreed", desc: "Crypto Fear & Greed index ($0.01 USDC/call).", method: "GET", path: "/api/feargreed", params: [] },
  { name: "x402_holidays", desc: "Public holidays by country and year ($0.01 USDC/call).", method: "GET", path: "/api/holidays", params: [P("country", "string", false, "Country code, e.g. US"), P("year", "number", false, "Year, e.g. 2026")] },
  { name: "x402_video", desc: "AI video generation: ~10s 720p clip from a prompt ($0.50 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'media').", method: "POST", path: "/api/video", params: [P("prompt", "string", true, "Video prompt")], jobType: "media" },
  { name: "x402_tts", desc: "Text-to-speech: spoken-word mp3 ($0.25 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'media').", method: "POST", path: "/api/tts", params: [P("text", "string", true, "Text to speak"), P("voice", "string", false, "Voice id (optional)")], jobType: "media" },
  { name: "x402_podcast", desc: "AI podcast episode from a topic or a full script ($0.50 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'media').", method: "POST", path: "/api/podcast", params: [P("topic", "string", false, "Episode topic (or provide script)"), P("script", "string", false, "Full script (or provide topic)")], jobType: "media", validate: (a) => (a.topic || a.script ? null : "Provide 'topic' or 'script' (at least one).") },
  { name: "x402_translate", desc: "Translate text into any language ($0.01 USDC/call).", method: "POST", path: "/api/translate", params: [P("text", "string", true, "Text to translate"), P("target", "string", false, "Target language (default English)")] },
  { name: "x402_sentiment", desc: "Sentiment analysis: positive / negative / neutral ($0.01 USDC/call).", method: "POST", path: "/api/sentiment", params: [P("text", "string", true, "Text to analyze")] },
  { name: "x402_places", desc: "Find restaurants, shops, landmarks with coordinates ($0.01 USDC/call).", method: "GET", path: "/api/places", params: [P("query", "string", true, "What to find, e.g. 'coffee'"), P("lat", "number", false, "Latitude"), P("lon", "number", false, "Longitude"), P("limit", "number", false, "Max results")] },
  { name: "x402_qrcode", desc: "QR code generator — returns a PNG image ($0.01 USDC/call).", method: "GET", path: "/api/qrcode", params: [P("text", "string", true, "Text/URL to encode"), P("size", "number", false, "Pixels (default 256)")], binary: "image/png" },
  { name: "x402_screenshot", desc: "Full-page website screenshot as PNG, rendered on dedicated hardware ($0.05 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'box').", method: "POST", path: "/api/screenshot", params: [P("url", "string", true, "Page URL")], jobType: "box" },
  { name: "x402_render", desc: "Render a page in a real browser (JavaScript included), return clean text ($0.02 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'box').", method: "POST", path: "/api/render", params: [P("url", "string", true, "Page URL")], jobType: "box" },
  { name: "x402_ocr", desc: "Image text extraction (OCR) ($0.02 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'box').", method: "POST", path: "/api/ocr", params: [P("file", "string", false, "Base64-encoded image (or use url)"), P("filename", "string", false, "Filename, e.g. photo.png"), P("url", "string", false, "Image URL (or use file)")], jobType: "box", validate: (a) => (a.file || a.url ? null : "Provide 'file' (base64) or 'url'.") },
  { name: "x402_metadata", desc: "Full EXIF/file metadata report as JSON ($0.02 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'box').", method: "POST", path: "/api/metadata", params: [P("file", "string", false, "Base64-encoded file (or use url)"), P("filename", "string", false, "Filename"), P("url", "string", false, "File URL (or use file)")], jobType: "box", validate: (a) => (a.file || a.url ? null : "Provide 'file' (base64) or 'url'.") },
  { name: "x402_pdftext", desc: "PDF text extraction ($0.02 USDC/call). ASYNC — returns a job ticket; poll with x402_poll_job (job_type 'box').", method: "POST", path: "/api/pdftext", params: [P("file", "string", false, "Base64-encoded PDF (or use url)"), P("filename", "string", false, "Filename"), P("url", "string", false, "PDF URL (or use file)")], jobType: "box", validate: (a) => (a.file || a.url ? null : "Provide 'file' (base64) or 'url'.") },
];

// ---------- helpers ----------
function zodShape(def: ToolDef): Record<string, z.ZodTypeAny> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const p of def.params) {
    const base = p.type === "number" ? z.number() : z.string();
    shape[p.name] = (p.required ? base : base.optional()).describe(p.desc) as z.ZodTypeAny;
  }
  return shape;
}

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

async function callPaid(def: ToolDef, args: Record<string, unknown>): Promise<{ content: Content[]; isError?: boolean }> {
  try {
    if (def.validate) {
      const err = def.validate(args);
      if (err) return { content: [{ type: "text", text: `Invalid arguments: ${err}` }], isError: true };
    }
    const fp = getPaidFetch();
    let url = BASE + def.path;
    let init: RequestInit = { method: def.method };
    if (def.method === "GET") {
      const qs = new URLSearchParams();
      for (const p of def.params) {
        const v = args[p.name];
        if (v !== undefined && v !== null && v !== "") qs.set(p.name, String(v));
      }
      const s = qs.toString();
      if (s) url += "?" + s;
    } else {
      const body: Record<string, unknown> = {};
      for (const p of def.params) {
        const v = args[p.name];
        if (v !== undefined && v !== null && v !== "") body[p.name] = v;
      }
      init = { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
    }
    const res = await fp(url, init);
    const ctype = res.headers.get("content-type") || "";
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return {
        content: [{ type: "text", text: `HTTP ${res.status} from ${def.path}: ${t.slice(0, 500) || "(empty body)"}\nIf this is a payment failure, fund the ELEETH_X402_KEY wallet with a little Base USDC and retry.` }],
        isError: true,
      };
    }
    if (def.binary || ctype.startsWith("image/")) {
      const buf = Buffer.from(await res.arrayBuffer());
      const mime = def.binary || "image/png";
      return {
        content: [
          { type: "image", data: buf.toString("base64"), mimeType: mime },
          { type: "text", text: `PNG image returned (${buf.length} bytes).` },
        ],
      };
    }
    const text = await res.text();
    let out = text;
    try {
      out = JSON.stringify(JSON.parse(text), null, 2);
    } catch { /* not JSON, keep raw */ }
    if (def.jobType) {
      out += `\n\nThis is an ASYNC job ticket. Use the x402_poll_job tool with the job_id above and job_type "${def.jobType}" to wait for the result (polling is free).`;
    }
    return { content: [{ type: "text", text: out.slice(0, 60000) }] };
  } catch (e) {
    return { content: [{ type: "text", text: `Error: ${(e as Error).message}` }], isError: true };
  }
}

async function pollJob(args: { job_id: string; job_type: string; max_wait_seconds?: number; poll_interval_seconds?: number }): Promise<{ content: Content[]; isError?: boolean }> {
  const { job_id, job_type } = args;
  if (!/^[0-9a-f-]{8,80}$/i.test(job_id)) {
    return { content: [{ type: "text", text: "Invalid job_id format." }], isError: true };
  }
  if (job_type !== "media" && job_type !== "box") {
    return { content: [{ type: "text", text: "job_type must be 'media' (video/tts/podcast) or 'box' (screenshot/render/ocr/metadata/pdftext)." }], isError: true };
  }
  const maxWait = Math.min(Math.max(args.max_wait_seconds ?? 300, 15), 1800);
  const interval = Math.min(Math.max(args.poll_interval_seconds ?? 15, 5), 120);
  const statusUrl = `${BASE}/api/${job_type}/status?id=${encodeURIComponent(job_id)}`;
  const deadline = Date.now() + maxWait * 1000;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    try {
      const res = await fetch(statusUrl);
      last = (await res.json()) as Record<string, unknown>;
    } catch (e) {
      last = { status: "error", detail: `status fetch failed: ${(e as Error).message}` };
      break;
    }
    const st = String(last.status || "");
    if (st === "done" || st === "failed") break;
    await new Promise((r) => setTimeout(r, interval * 1000));
  }
  const out: Record<string, unknown> = { ...last };
  const st = String(last.status || "");
  if (st === "done") {
    const fileUrl = (last.file_url || last.media_url || last.video_url) as string | undefined;
    if (fileUrl) out.download_url = fileUrl.startsWith("http") ? fileUrl : BASE + fileUrl;
    out.note = "Job complete. download_url fetches the finished file (free, no payment needed).";
  } else if (st !== "failed") {
    out.note = `Still '${st || "unknown"}' after ${maxWait}s. Call x402_poll_job again with the same job_id to keep waiting.`;
  }
  return { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] };
}

// ---------- server ----------
const server = new McpServer({ name: "eleeth-x402", version: "1.0.0" });

for (const def of TOOLS) {
  server.tool(def.name, def.desc, zodShape(def), async (args: Record<string, unknown>) => callPaid(def, args));
}

server.tool(
  "x402_poll_job",
  "Poll an async x402.eleeth.com job until it finishes (FREE — no payment). Use after x402_video, x402_tts, x402_podcast (job_type 'media') or x402_screenshot, x402_render, x402_ocr, x402_metadata, x402_pdftext (job_type 'box'). Returns the download URL when done.",
  {
    job_id: z.string().describe("The job_id from the job ticket"),
    job_type: z.enum(["media", "box"]).describe("'media' for video/tts/podcast, 'box' for screenshot/render/ocr/metadata/pdftext"),
    max_wait_seconds: z.number().optional().describe("Max time to wait, 15–1800 (default 300)"),
    poll_interval_seconds: z.number().optional().describe("Seconds between polls, 5–120 (default 15)"),
  },
  async (args) => pollJob(args as { job_id: string; job_type: string; max_wait_seconds?: number; poll_interval_seconds?: number })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  console.error("eleeth-x402-mcp failed to start:", e);
  process.exit(1);
});
