/* Cardfolio signing relay — a tiny Cloudflare Worker (free plan).
   Cardfolio sends the card design here; the Worker asks the free
   walletmcppass.com service to sign it and returns a download link
   for the finished Apple Wallet pass. Nothing is stored here.
   The service asks for a contact email; set it as the secret CONTACT_EMAIL
   in the Worker's settings so it never appears in this code. */

const ALLOWED_ORIGINS = ["https://patricialundgren.github.io"];
const SIGNER = "https://walletmcppass.com/mcp";
const MAX_BODY = 3_000_000;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      "Access-Control-Allow-Origin": allowed ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
      Vary: "Origin",
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    // GET /pass/<id> hands the signed pass to Safari with Apple's pass type,
    // so iPhone shows its Add to Apple Wallet screen right away.
    const path = new URL(request.url).pathname.match(/^\/pass\/([A-Za-z0-9_-]{8,80})$/);
    if (request.method === "GET" && path) {
      const file = await fetch("https://walletmcppass.com/download/" + path[1]);
      if (!file.ok) return new Response("This pass has expired. Go back to Cardfolio and create it again.", { status: 410, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      return new Response(file.body, { headers: { "Content-Type": "application/vnd.apple.pkpass", "Content-Disposition": "inline; filename=card.pkpass", "Cache-Control": "no-store" } });
    }
    if (request.method !== "POST" || !allowed) return json({ error: "Not allowed" }, 403);

    const body = await request.text();
    if (body.length > MAX_BODY) return json({ error: "Card is too large. Try a smaller logo." }, 413);
    let args;
    try { args = JSON.parse(body); } catch { return json({ error: "Invalid request" }, 400); }

    try {
      if (!env.CONTACT_EMAIL) return json({ error: "The relay is missing its CONTACT_EMAIL setting" }, 500);
      const pass = await createPass({ ...args, contact_email: env.CONTACT_EMAIL, x402_ready: false });
      // ?file=1 returns the signed pass file itself, so the app can share it
      if (new URL(request.url).searchParams.get("file")) {
        const file = await fetch(pass.download_url);
        if (!file.ok) return json({ error: "Couldn’t fetch the signed pass" }, 502);
        return new Response(file.body, { headers: { ...cors, "Content-Type": "application/vnd.apple.pkpass" } });
      }
      return json(pass);
    } catch (e) {
      const limited = /\b(402|429)\b/.test(e.message);
      return json({ error: limited ? "The free signing limit for today is used up. Try again after 01:00 Swedish time." : e.message }, limited ? 429 : 502);
    }
  },
};

async function rpc(method, params, id, session) {
  const res = await fetch(SIGNER, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(session ? { "Mcp-Session-Id": session } : {}),
    },
    body: JSON.stringify(id == null ? { jsonrpc: "2.0", method, params } : { jsonrpc: "2.0", id, method, params }),
  });
  const sid = res.headers.get("Mcp-Session-Id") || session;
  const text = await res.text();
  if (!res.ok) throw new Error(`Signing service error ${res.status}: ${text.slice(0, 200)}`);
  if (id == null) return { sid };

  let msg = null;
  if ((res.headers.get("Content-Type") || "").includes("event-stream")) {
    for (const line of text.split("\n")) {
      if (!line.startsWith("data:")) continue;
      try { const m = JSON.parse(line.slice(5).trim()); if (m.id === id) msg = m; } catch {}
    }
  } else {
    msg = JSON.parse(text);
  }
  if (!msg) throw new Error("No answer from the signing service");
  if (msg.error) throw new Error(msg.error.message || "Signing failed");
  return { sid, result: msg.result };
}

async function createPass(args) {
  const init = await rpc("initialize", {
    protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "cardfolio", version: "1.0" },
  }, 1);
  await rpc("notifications/initialized", {}, null, init.sid);
  const { result } = await rpc("tools/call", { name: "create_wallet_pass", arguments: args }, 2, init.sid);

  const texts = (result.content || []).filter((c) => c.type === "text").map((c) => c.text);
  if (result.isError) throw new Error(texts.join(" ").slice(0, 300) || "Signing failed");

  let data = result.structuredContent?.result ?? result.structuredContent;
  if (!data?.download_url) {
    for (const t of texts) {
      try { const parsed = JSON.parse(t); if (parsed.download_url) { data = parsed; break; } } catch {}
      const m = t.match(/https?:\/\/\S+\/download\/[^\s"')]+/);
      if (m) { data = { download_url: m[0] }; break; }
    }
  }
  if (!data?.download_url) throw new Error("The signing service didn’t return a pass");
  return { download_url: data.download_url, expires_in_seconds: data.expires_in_seconds || 3600 };
}
