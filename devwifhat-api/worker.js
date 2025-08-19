export default {
  async fetch(req, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });

    const url = new URL(req.url);
    try {
      if (url.pathname === "/leaderboard" && req.method === "GET") {
        const windowDays = Number(url.searchParams.get("days") || 30);
        const since = Date.now() - windowDays * 24 * 3600 * 1000;

        // Most searched in window
        const top = await env.DB.prepare(
          `SELECT s.address, COUNT(*) AS hits
           FROM searches s WHERE s.ts >= ? GROUP BY s.address
           ORDER BY hits DESC LIMIT 10`
        ).bind(since).all();

        // Join metadata
        const mostSearched = [];
        for (const row of top.results) {
          const meta = await env.DB.prepare(
            `SELECT address, symbol, name, last_hype AS hype, last_safety AS safety
             FROM tokens WHERE address = ? LIMIT 1`
          ).bind(row.address).first();
          mostSearched.push({
            address: row.address,
            symbol: meta?.symbol || null,
            name: meta?.name || null,
            hype: meta?.hype || 0,
            safety: meta?.safety || 0,
            hits: row.hits,
          });
        }

        // Top hype/safety (últimos scores vistos)
        const topHype = (await env.DB.prepare(
          `SELECT address, symbol, name, last_hype AS hype
             FROM tokens ORDER BY last_hype DESC, last_seen DESC LIMIT 10`
        ).all()).results;

        const topSafety = (await env.DB.prepare(
          `SELECT address, symbol, name, last_safety AS safety
             FROM tokens ORDER BY last_safety DESC, last_seen DESC LIMIT 10`
        ).all()).results;

        // numeração (rank)
        const rankify = (arr, key) => arr.map((x, i) => ({ ...x, rank: i + 1, [key]: x[key] | 0 }));
        const body = JSON.stringify({
          mostSearched: rankify(mostSearched, "hits"),
          topHype: rankify(topHype, "hype"),
          topSafety: rankify(topSafety, "safety"),
        });

        return new Response(body, { headers: { "content-type": "application/json", ...cors } });
      }

      if (url.pathname === "/record" && req.method === "POST") {
        const data = await req.json();
        const now = Date.now();
        const address = String(data.address || "").toLowerCase();
        const chainId = String(data.chainId || "pulsechain");
        const symbol = data.symbol || null;
        const name = data.name || null;
        const hype = Math.max(0, Math.min(100, Number(data.hype || 0)));
        const safety = Math.max(0, Math.min(100, Number(data.safety || 0)));

        if (!address.startsWith("0x")) {
          return new Response(JSON.stringify({ ok: false, error: "invalid address" }), {
            status: 400, headers: { "content-type": "application/json", ...cors },
          });
        }

        // upsert tokens
        await env.DB.prepare(
          `INSERT INTO tokens (address, chain_id, symbol, name, last_hype, last_safety, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(address) DO UPDATE SET
             chain_id=excluded.chain_id,
             symbol=COALESCE(excluded.symbol, tokens.symbol),
             name=COALESCE(excluded.name, tokens.name),
             last_hype=MAX(tokens.last_hype, excluded.last_hype),
             last_safety=MAX(tokens.last_safety, excluded.last_safety),
             last_seen=excluded.last_seen`
        ).bind(address, chainId, symbol, name, hype, safety, now).run();

        // log de busca
        await env.DB.prepare(`INSERT INTO searches (address, ts) VALUES (?, ?)`).bind(address, now).run();

        return new Response(JSON.stringify({ ok: true }), {
          headers: { "content-type": "application/json", ...cors },
        });
      }

      return new Response("Not found", { status: 404, headers: cors });
    } catch (e) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), {
        status: 500, headers: { "content-type": "application/json", ...cors },
      });
    }
  },
};

