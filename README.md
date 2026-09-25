# eleeth-x402-mcp

An MCP server that wraps [x402.eleeth.com](https://x402.eleeth.com) — **34 pay-per-call APIs** for AI agents, paid in USDC on Base mainnet via the [x402 v2](https://x402.org) payment protocol.

No signup. No API key. **The payment is the credential.** Each tool call automatically handles the `402 Payment Required` handshake: the server reads the payment requirements, signs the USDC transfer with your wallet, and retries — all inside the tool call.

## What you get

34 tools, one per paid endpoint:

| Area | Tools |
|---|---|
| Web & research | `x402_search`, `x402_read`, `x402_render`, `x402_summarize`, `x402_news`, `x402_rss`, `x402_wayback`, `x402_arxiv`, `x402_wiki` |
| AI generation | `x402_chat`, `x402_image`, `x402_video`, `x402_tts`, `x402_podcast` |
| Data | `x402_crypto`, `x402_weather`, `x402_stock`, `x402_fx`, `x402_sec`, `x402_feargreed`, `x402_holidays`, `x402_places` |
| Recon & audits | `x402_dns`, `x402_whois`, `x402_certs`, `x402_seo`, `x402_github` |
| Box-hosted tools | `x402_screenshot`, `x402_ocr`, `x402_metadata`, `x402_pdftext` |
| Utilities | `x402_translate`, `x402_sentiment`, `x402_qrcode` |
| Async jobs | `x402_poll_job` (free) |

Prices: $0.01/call for most, $0.02 for chat/summarize/seo/render/ocr/metadata/pdftext, $0.05 for image/screenshot, $0.25 for text-to-speech, $0.50 for video/podcast — all in USDC on Base mainnet.

The async tools (`x402_video`, `x402_tts`, `x402_podcast`, `x402_screenshot`, `x402_render`, `x402_ocr`, `x402_metadata`, `x402_pdftext`) return a **job ticket**. Poll it free with `x402_poll_job` (`job_type: "media"` for video/tts/podcast, `"box"` for the rest) — it waits and returns the download URL when done.

## Install

```bash
git clone <this-repo> && cd x402-mcp
npm install
npm run build
```

Requires Node 18+. You also need a Base wallet private key holding a little USDC — any wallet works; a fresh throwaway is fine. Fund it with ~$1 to start; most calls cost a penny.

## Use with Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "eleeth-x402": {
      "command": "node",
      "args": ["/path/to/x402-mcp/dist/index.js"],
      "env": {
        "ELEETH_X402_KEY": "0xYOUR_BASE_WALLET_PRIVATE_KEY"
      }
    }
  }
}
```

Restart Claude Desktop. The 34 tools appear automatically — no signup, no API keys to paste anywhere.

Works the same way with any STDIO MCP client (Cursor, OpenClaw, etc.): command `node`, args `[…/dist/index.js]`, env `ELEETH_X402_KEY`.

## First run

The very first paid call from a new key will do the visible 402 dance: request → `402 Payment Required` → wallet signs $0.01 USDC → retry → result. If the wallet is empty, the tool tells you to fund it — nothing is charged until the chain settles.

Free helpers: `x402_poll_job` costs nothing (job status endpoints are free), and `/health` is free.

## How it works

- Transport: STDIO only (no network ports).
- Payments: `@x402/fetch` + `@x402/evm` wrap every call; `ExactEvmScheme` signs an EIP-3009 USDC authorization per call on `eip155:8453` (Base mainnet), verified by the Coinbase CDP facilitator.
- Your private key never leaves your machine — signing happens locally inside this process.

## Test

```bash
node test-list.mjs   # spawns the server over STDIO, lists all tools, smoke-tests poll + key errors
```
