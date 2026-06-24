export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const url = new URL(request.url);
    const room = decodeURIComponent(url.pathname.replace(/^\//, ""));

    if (!/^[A-Za-z0-9_-]{4,32}$/.test(room)) {
      return new Response(JSON.stringify({ error: "invalid room" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const key = `room:${room}`;

    if (request.method === "GET") {
      const data = await env.SYNC_KV.get(key);
      return new Response(data || "{}", {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (request.method === "PUT") {
      const body = await request.text();
      if (!body || body.length > 500000) {
        return new Response(JSON.stringify({ error: "payload too large" }), {
          status: 413,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      await env.SYNC_KV.put(key, body);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response("Method Not Allowed", { status: 405, headers: cors });
  },
};
