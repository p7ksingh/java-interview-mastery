// netlify/functions/counter.mjs
// Self-hosted visitor counter + visitor log

export default async (req, context) => {
  const { getStore } = await import("@netlify/blobs");
  
  const counterStore = getStore("visitor-counter");
  const logStore = getStore("visitor-log");
  
  const key = "visits";
  
  try {
    let countStr = await counterStore.get(key);
    let count = countStr ? parseInt(countStr, 10) : 0;
    
    if (req.method === "POST") {
      count++;
      await counterStore.set(key, String(count));
      
      // Log visitor info
      var ip = req.headers.get("x-forwarded-for") || req.headers.get("client-ip") || "unknown";
      var ua = req.headers.get("user-agent") || "unknown";
      var referer = req.headers.get("referer") || "direct";
      var country = req.headers.get("x-country") || context.geo?.country?.name || "unknown";
      var city = req.headers.get("x-nf-client-connection-ip") ? "" : (context.geo?.city || "");
      
      var entry = {
        visit: count,
        time: new Date().toISOString(),
        ip: ip.split(",")[0].trim(),
        country: country,
        city: city,
        device: parseDevice(ua),
        browser: parseBrowser(ua),
        referer: referer
      };
      
      // Store each visit with timestamp key
      await logStore.set("v_" + count, JSON.stringify(entry));
      
      // Also append to recent list (last 100)
      var recentStr = await logStore.get("recent") || "[]";
      var recent = JSON.parse(recentStr);
      recent.unshift(entry);
      if (recent.length > 100) recent = recent.slice(0, 100);
      await logStore.set("recent", JSON.stringify(recent));
    }
    
    // GET /api/counter?log=true → return recent visitors (for admin)
    var url = new URL(req.url);
    if (url.searchParams.get("log") === "true") {
      var recentStr = await logStore.get("recent") || "[]";
      return new Response(recentStr, {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }
    
    return new Response(JSON.stringify({ count }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ count: 0, error: e.message }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
};

function parseDevice(ua) {
  if (/Mobile|Android|iPhone|iPad/i.test(ua)) return "Mobile";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Desktop";
}

function parseBrowser(ua) {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  if (/Opera|OPR/i.test(ua)) return "Opera";
  return "Other";
}

export const config = { path: "/api/counter" };
