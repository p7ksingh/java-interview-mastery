// netlify/functions/track.mjs
// Smart Analytics — track page views, time, questions + live count

const GITHUB_REPO = "p7ksingh/javabypankaj-logs";

export default async (req, context) => {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore("analytics");
  const url = new URL(req.url);
  const path = url.pathname;

  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("", { headers: corsHeaders() });
  }

  try {
    // === /api/live — return active users count ===
    if (path === "/api/live") {
      var activeStr = await store.get("active_users") || "{}";
      var active = JSON.parse(activeStr);
      var now = Date.now();
      var count = 0;
      // Count users seen in last 5 minutes
      for (var id in active) {
        if (now - active[id] < 300000) count++;
        else delete active[id];
      }
      await store.set("active_users", JSON.stringify(active));
      return resp({ count: count });
    }

    // === /api/track — receive tracking events ===
    if (path === "/api/track" && req.method === "POST") {
      var body = await req.json();
      var ip = (req.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
      var ua = req.headers.get("user-agent") || "";
      var visitorId = simpleHash(ip + ua.slice(0, 50));

      // Update active users
      var activeStr = await store.get("active_users") || "{}";
      var active = JSON.parse(activeStr);
      active[visitorId] = Date.now();
      await store.set("active_users", JSON.stringify(active));

      // Build event
      var event = {
        t: new Date().toISOString(),
        vid: visitorId,
        ip: ip,
        country: req.headers.get("x-country") || context.geo?.country?.name || "?",
        city: context.geo?.city || "",
        device: /Mobile|Android|iPhone/i.test(ua) ? "Mobile" : "Desktop",
        browser: parseBrowser(ua),
        type: body.type || "pageview",       // pageview, question, timeupdate
        page: body.page || "",                // #/home, #/chapter/1, etc
        chapter: body.chapter || null,
        topic: body.topic || null,
        question: body.question || null,
        timeSpent: body.timeSpent || 0,       // seconds on previous page
        referer: req.headers.get("referer") || "direct"
      };

      // Store in Netlify Blobs — daily summary
      var today = new Date().toISOString().slice(0, 10);
      var dayKey = "day_" + today;
      var dayStr = await store.get(dayKey) || "[]";
      var dayEvents = JSON.parse(dayStr);
      dayEvents.push(event);
      await store.set(dayKey, JSON.stringify(dayEvents));

      // Update aggregate stats
      await updateStats(store, event);

      // Push to GitHub (async, monthly file)
      pushToGitHub(event).catch(() => {});

      return resp({ ok: true });
    }

    // === /api/track?stats=true — return analytics summary ===
    if (url.searchParams.get("stats") === "true") {
      var stats = JSON.parse(await store.get("stats") || "{}");
      var activeStr = await store.get("active_users") || "{}";
      var active = JSON.parse(activeStr);
      var now = Date.now();
      var liveCount = 0;
      for (var id in active) { if (now - active[id] < 300000) liveCount++; }
      stats.liveNow = liveCount;
      return resp(JSON.stringify(stats, null, 2));
    }

    return resp(JSON.stringify({ error: "unknown path" }));
  } catch (e) {
    return resp(JSON.stringify({ error: e.message }));
  }
};

async function updateStats(store, event) {
  var statsStr = await store.get("stats") || "{}";
  var s = JSON.parse(statsStr);

  // Total page views
  s.totalViews = (s.totalViews || 0) + 1;

  // Unique visitors (by vid)
  if (!s.visitors) s.visitors = {};
  s.visitors[event.vid] = (s.visitors[event.vid] || 0) + 1;
  s.uniqueVisitors = Object.keys(s.visitors).length;

  // Chapter popularity
  if (event.chapter) {
    if (!s.chapters) s.chapters = {};
    s.chapters[event.chapter] = (s.chapters[event.chapter] || 0) + 1;
  }

  // Question opens
  if (event.type === "question" && event.question) {
    if (!s.questions) s.questions = {};
    s.questions[event.question] = (s.questions[event.question] || 0) + 1;
  }

  // Countries
  if (event.country && event.country !== "?") {
    if (!s.countries) s.countries = {};
    s.countries[event.country] = (s.countries[event.country] || 0) + 1;
  }

  // Devices
  if (!s.devices) s.devices = {};
  s.devices[event.device] = (s.devices[event.device] || 0) + 1;

  // Browsers
  if (!s.browsers) s.browsers = {};
  s.browsers[event.browser] = (s.browsers[event.browser] || 0) + 1;

  // Hourly heatmap (0-23)
  var hour = new Date(event.t).getUTCHours();
  if (!s.hours) s.hours = {};
  s.hours[hour] = (s.hours[hour] || 0) + 1;

  // Daily views
  var day = event.t.slice(0, 10);
  if (!s.days) s.days = {};
  s.days[day] = (s.days[day] || 0) + 1;

  // Total time spent
  if (event.timeSpent > 0) {
    s.totalTimeSpent = (s.totalTimeSpent || 0) + event.timeSpent;
  }

  await store.set("stats", JSON.stringify(s));
}

function parseBrowser(ua) {
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) return "Chrome";
  if (/Firefox/i.test(ua)) return "Firefox";
  if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) return "Safari";
  return "Other";
}

function simpleHash(str) {
  var h = 0;
  for (var i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
  return "v" + Math.abs(h).toString(36);
}

function resp(body) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: corsHeaders()
  });
}

function corsHeaders() {
  return { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Cache-Control": "no-cache" };
}

async function pushToGitHub(entry) {
  var token = process.env.GH_TOKEN;
  if (!token) return;
  var now = new Date(entry.t);
  var fileName = "analytics/" + now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + ".json";
  var apiBase = "https://api.github.com/repos/" + GITHUB_REPO + "/contents/" + fileName;
  var headers = { "Authorization": "token " + token, "Accept": "application/vnd.github.v3+json", "User-Agent": "javabypankaj" };

  var existing = []; var sha = null;
  try {
    var r = await fetch(apiBase, { headers });
    if (r.ok) { var d = await r.json(); sha = d.sha; existing = JSON.parse(atob(d.content.replace(/\n/g, ""))); }
  } catch (e) {}

  existing.push(entry);
  var body = { message: entry.type + ": " + (entry.page || "").slice(0, 40) + " [" + entry.country + " " + entry.device + "]", content: btoa(JSON.stringify(existing, null, 2)) };
  if (sha) body.sha = sha;
  await fetch(apiBase, { method: "PUT", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export const config = { path: ["/api/track", "/api/live"] };
