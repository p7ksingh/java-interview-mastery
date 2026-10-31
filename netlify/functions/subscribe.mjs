// netlify/functions/subscribe.mjs
// Email subscription — stores emails in GitHub repo

const GITHUB_REPO = "p7ksingh/javabypankaj-logs";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("", { headers: cors() });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { headers: cors() });
  }

  try {
    var body = await req.json();
    var email = (body.email || "").trim().toLowerCase();

    // Validate email
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: cors() });
    }

    var ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
    var entry = {
      email: email,
      time: new Date().toISOString(),
      ip: ip,
      source: body.source || "popup"
    };

    // Push to GitHub
    var token = process.env.GH_TOKEN;
    if (token) {
      var fileName = "subscribers/emails.json";
      var apiBase = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + fileName;
      var headers = { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json", "User-Agent": "javabypankaj" };

      var existing = []; var sha = null;
      try {
        var r = await fetch(apiBase, { headers });
        if (r.ok) { var d = await r.json(); sha = d.sha; existing = JSON.parse(atob(d.content.replace(/\n/g, ""))); }
      } catch (e) {}

      // Check duplicate
      var isDupe = existing.some(function(e) { return e.email === email; });
      if (isDupe) {
        return new Response(JSON.stringify({ ok: true, msg: "Already subscribed!" }), { headers: cors() });
      }

      existing.push(entry);

      var putBody = {
        message: "New subscriber: " + email,
        content: btoa(JSON.stringify(existing, null, 2))
      };
      if (sha) putBody.sha = sha;

      await fetch(apiBase, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(putBody)
      });
    }

    return new Response(JSON.stringify({ ok: true, msg: "Subscribed!" }), { headers: cors() });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: cors() });
  }
};

function cors() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
}

export const config = { path: "/api/subscribe" };
