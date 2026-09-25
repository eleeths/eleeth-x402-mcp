// test-list.mjs — smoke test: spawn the MCP server over STDIO, ListTools
import { spawn } from "node:child_process";

const child = spawn("node", ["dist/index.js"], { stdio: ["pipe", "pipe", "inherit"] });
let buf = "";
let id = 0;
const pending = new Map();

child.stdout.on("data", (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  }
});

function req(method, params = {}) {
  return new Promise((resolve) => {
    const myId = ++id;
    pending.set(myId, resolve);
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: myId, method, params }) + "\n");
  });
}

await req("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "smoke-test", version: "0.0.1" },
});
const list = await req("tools/list");
const tools = list.result.tools;
console.log("TOOL COUNT:", tools.length);
for (const t of tools) console.log(" -", t.name);

// sanity: call x402_poll_job with a bad job_id (free path, no key needed)
const bad = await req("tools/call", {
  name: "x402_poll_job",
  arguments: { job_id: "bogus", job_type: "media", max_wait_seconds: 15, poll_interval_seconds: 5 },
});
console.log("\npoll_job(bogus) ->", JSON.stringify(bad.result.content[0].text).slice(0, 120));

// sanity: call a paid tool with no key set -> expect the ELEETH_X402_KEY error text
const nokey = await req("tools/call", { name: "x402_feargreed", arguments: {} });
console.log("\nfeargreed(no key) ->", JSON.stringify(nokey.result.content[0].text).slice(0, 160));
console.log("isError:", nokey.result.isError === true);

child.kill();
process.exit(0);
