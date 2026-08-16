const DEFAULT_ALLOWED_ORIGINS = ["https://spite.github.io"];

const ALLOWED_HOSTS = new Set([
  "khm0.google.com",
  "khm1.google.com",
  "khm2.google.com",
  "khm3.google.com",
  "tile.nextzen.org",
  "s3.amazonaws.com",
  "server.arcgisonline.com",
  "basemap.nationalmap.gov",
  "data.geopf.fr",
  "gitc.earthdata.nasa.gov",
  "tiles.maps.eox.at",
  "a.tile.opentopomap.org",
  "basemaps.cartocdn.com",
  "wms.gebco.net",
]);

const CACHE_SECONDS = 86400;

function allowedOrigins(env) {
  const configured = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return configured.length ? configured : DEFAULT_ALLOWED_ORIGINS;
}

function baseHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function deny(status, message) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain", Vary: "Origin" },
  });
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get("Origin");

    if (!origin || !allowedOrigins(env).includes(origin)) {
      return deny(403, "origin not allowed");
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders(origin) });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return deny(405, "method not allowed");
    }

    const target = new URL(request.url).searchParams.get("u");
    if (!target) return deny(400, "missing u parameter");

    let upstream;
    try {
      upstream = new URL(target);
    } catch {
      return deny(400, "malformed u parameter");
    }
    if (upstream.protocol !== "https:") {
      return deny(400, "https upstreams only");
    }
    if (!ALLOWED_HOSTS.has(upstream.hostname)) {
      return deny(403, `host not allowed: ${upstream.hostname}`);
    }

    const cache = caches.default;
    const cacheKey = new Request(upstream.toString(), { method: "GET" });

    let response = await cache.match(cacheKey);
    if (!response) {
      const fetched = await fetch(upstream.toString(), {
        headers: {
          Accept: "image/*",
          "User-Agent":
            "BlockyEarth/1.0 (+https://github.com/spite/BlockyEarth)",
        },
        cf: { cacheTtl: CACHE_SECONDS, cacheEverything: true },
      });

      if (!fetched.ok) {
        return deny(fetched.status, `upstream ${fetched.status}`);
      }

      response = new Response(fetched.body, fetched);
      response.headers.set(
        "Cache-Control",
        `public, max-age=${CACHE_SECONDS}, immutable`
      );
      response.headers.delete("Set-Cookie");
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    const out = new Response(response.body, response);
    for (const [k, v] of Object.entries(baseHeaders(origin))) {
      out.headers.set(k, v);
    }
    return out;
  },
};
