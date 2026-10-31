// netlify/functions/counter.js
// Self-hosted visitor counter — no external API dependency
// Uses Netlify Blobs for persistent storage (free)

import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("visitor-counter");
  const key = "total-visits";

  try {
    // Get current count
    let countStr = await store.get(key);
    let count = countStr ? parseInt(countStr, 10) : 0;

    // Check if this is a hit (POST) or just a read (GET)
    if (req.method === "POST") {
      count++;
      await store.set(key, String(count));
    }

    return new Response(JSON.stringify({ count: count }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, error: e.message }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};

export const config = {
  path: "/api/counter"
};
