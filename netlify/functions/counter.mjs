// netlify/functions/counter.mjs
// Self-hosted visitor counter + logs to GitHub repo

const GITHUB_REPO = "p7ksingh/javabypankaj-logs";

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

      // Build visitor entry
      var ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
      var ua = req.headers.get("user-agent") || "unknown";
      var entry = {
        visit: count,
        time: new Date().toISOString(),
        ip: ip,
        country: req.headers.get("x-country") || context.geo?.country?.name || "unknown",
        city: context.geo?.city || "",
        device: /Mobile|Android|iPhone|iPad/i.test(ua) ? "Mobile" : "Desktop",
        browser: parseBrowser(ua),
        referer: req.headers.get("referer") || "direct"
      };

      // Save to Netlify Blobs (last 100)
      var recentStr = await logStore.get("recent") || "[]";
      var recent = JSON.parse(recentStr);
      recent.unshift(entry);
      if (recent.length > 100) recent = recent.slice(0, 100);
      await logStore.set("recent", JSON.stringify(recent));

      // Push to GitHub (async, don't block response)
      pushToGitHub(entry).catch(() => {});
    }

    // GET ?log=true → return recent visitors
    var url = new URL(req.url);
    if (url.searchParams.get("log") === "true") {
      var recentStr = await logStore.get("recent") || "[]";
      return resp(recentStr);
    }

    return resp(JSON.stringify({ count }));
  } catch (e) {
    return resp(JSON.stringify({ count: 0, error: e.message }));
  }
};

function parseBrowser(ua) {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Other";
}

function resp(body) {
  return new Response(body, {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache" }
  });
}

async function pushToGitHub(entry) {
  var token = process.env.GH_TOKEN;
  if (!token) return;

  var now = new Date(entry.time);
  var fileName = "logs/" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + ".json";

  var apiBase = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + fileName;
  var headers = {
    "Authorization": "token " + token,
    "Accept": "application/vnd.github.v3+json",
    "User-Agent": "javabypankaj-counter"
  };

  // Get existing file (if any)
  var existing = [];
  var sha = null;
  try {
    var getRes = await fetch(apiBase, { headers });
    if (getRes.ok) {
      var data = await getRes.json();
      sha = data.sha;
      var content = atob(data.content.replace(/\n/g, ""));
      existing = JSON.parse(content);
    }
  } catch (e) {}

  // Append new entry
  existing.push(entry);

  // Write back
  var body = {
    message: "Visit #" + entry.visit + " from " + entry.country + " (" + entry.device + " " + entry.browser + ")",
    content: btoa(JSON.stringify(existing, null, 2))
  };
  if (sha) body.sha = sha;

  await fetch(apiBase, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export const config = { path: "/api/counter" };
