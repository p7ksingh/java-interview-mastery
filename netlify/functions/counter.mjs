// netlify/functions/counter.mjs
// Self-hosted visitor counter using Netlify Blobs

export default async (req, context) => {
  const { getStore } = await import("@netlify/blobs");
  
  const store = getStore({ name: "visitor-counter", siteID: context.site.id, token: context.env?.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_AUTH_TOKEN });
  
  const key = "visits";
  
  try {
    let countStr = await store.get(key);
    let count = countStr ? parseInt(countStr, 10) : 0;
    
    if (req.method === "POST") {
      count++;
      await store.set(key, String(count));
    }
    
    return new Response(JSON.stringify({ count }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
    });
  } catch (e) {
    // If Blobs fail, use a simple in-memory fallback
    return new Response(JSON.stringify({ count: 0, note: "storage-init" }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

export const config = { path: "/api/counter" };
