/* Sends demo requests from the leads sites' "See it in action" form to a Gmail inbox.

   Runs on Cloudflare (a Pages Function at /api/demo-request, or through src/worker.js on a Worker).
   The message goes out through Gmail's own SMTP server (smtp.gmail.com, port 465, TLS) using a
   Gmail app password, over Cloudflare's TCP sockets. No npm packages and no build step.

   Each request becomes one email, HTML with a plain-text copy, sent as a blind copy (BCC) to every
   LEAD_TO address so recipients don't see each other. It includes the visitor's details as sent with
   the form (device, screen, language, time zone, how they arrived, what they looked at) and what
   Cloudflare knows about the connection (IP address, approximate location, network). Nothing is
   stored: each request is checked, emailed and forgotten.

   Variables (Cloudflare dashboard > the Worker or Pages project > Settings > Variables and Secrets):
     GMAIL_USER          Text. The Gmail address that sends the email, e.g. leads@gmail.com.
     GMAIL_APP_PASSWORD  Secret. A Gmail app password for that address (myaccount.google.com/apppasswords).
     LEAD_TO             Optional. Who receives requests (all as BCC): one address, or up to 10 separated
                         by commas, e.g. "sales@blinq.com.au, owner@gmail.com". Defaults to GMAIL_USER.
     SEND_FROM_NAME      Optional. The sender name on the email. Defaults to "BlinQ demo requests".
     TIMEZONE            Optional. Time zone for "Received" in the email, e.g. "Australia/Sydney" or
                         "Asia/Colombo". Defaults to UTC.
     TURNSTILE_SITE_KEY  Optional, together with TURNSTILE_SECRET: turns on the Turnstile check.
     TURNSTILE_SECRET    Secret. Recommended once the form gets spam.

   Without GMAIL_USER and GMAIL_APP_PASSWORD the endpoint reports that sending is off, and the
   form shows a message with the support email address instead. */

import { connect } from "cloudflare:sockets";

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const MAX_BODY_BYTES = 32 * 1024;
const LIMIT = 5;
const WINDOW_SECONDS = 600;
const MIN_FILL_MS = 2500;
const SMTP_TIMEOUT_MS = 20000;

const BUSINESS_TYPES = {
  retailer: "Window furnishing retailer",
  manufacturer: "Manufacturer",
  wholesaler: "Wholesaler / dealer",
  franchise: "Franchise",
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const ready = (env) => Boolean(env.GMAIL_USER && env.GMAIL_APP_PASSWORD);
const checking = (env) => Boolean(env.TURNSTILE_SITE_KEY && env.TURNSTILE_SECRET);

/* The form asks first whether sending is on, and whether it should show the Turnstile check. */
export async function onRequestGet({ env }) {
  return json({
    enabled: ready(env),
    turnstile: ready(env) && checking(env) ? env.TURNSTILE_SITE_KEY : null,
  });
}

export async function onRequestPost({ request, env }) {
  if (!ready(env)) return json({ error: "Sending is not switched on for this site yet." }, 503);

  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return json({ error: "Not allowed." }, 403);

  if (Number(request.headers.get("Content-Length") || 0) > MAX_BODY_BYTES) {
    return json({ error: "Something was wrong with that request." }, 413);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Something was wrong with that request." }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Something was wrong with that request." }, 400);

  // Bots: a filled-in hidden field or an instant submit gets a quiet "thanks" and no email.
  if (text(body.website, 200) || Number(body.elapsed) < MIN_FILL_MS) return json({ ok: true });

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (checking(env) && !(await human(env.TURNSTILE_SECRET, body.turnstile, ip))) {
    return json({ error: "The check did not pass. Tick it again, then send." }, 400);
  }

  const lead = {
    type: BUSINESS_TYPES[text(body.businessType, 20)] || "",
    name: text(body.name, 80),
    business: text(body.business, 100),
    email: text(body.email, 120),
    phone: text(body.phone, 40),
    country: text(body.country, 60),
    priority: text(body.priority, 80),
    site: text(body.site, 20),
    page: text(body.page, 300),
  };
  if (!lead.type) return json({ error: "Choose the type of business you run." }, 400);
  if (!lead.name) return json({ error: "Add your name." }, 400);
  if (!EMAIL.test(lead.email)) return json({ error: "Check your email address." }, 400);
  if (!lead.country) return json({ error: "Select your country." }, 400);
  if (body.consent !== true) return json({ error: "Tick the box so we can contact you." }, 400);

  if (await limited(request.url, ip)) {
    return json({ error: "That is a lot of requests in a short time. Try again in a few minutes." }, 429);
  }

  const user = text(env.GMAIL_USER, 120);
  const seen = new Set();
  const to = String(env.LEAD_TO || user)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => EMAIL.test(s) && !seen.has(s.toLowerCase()) && seen.add(s.toLowerCase()))
    .slice(0, 10);
  if (!EMAIL.test(user) || !to.length) return json({ error: "Sending is not switched on for this site yet." }, 503);

  const visitor = visitorContext(request, body.meta);
  const email = buildEmail(lead, visitor, { received: new Date(), timeZone: text(env.TIMEZONE, 60) });
  try {
    await withTimeout(
      sendMail({
        user,
        pass: String(env.GMAIL_APP_PASSWORD).replace(/\s+/g, ""), // app passwords are often pasted with spaces
        fromName: text(env.SEND_FROM_NAME, 60) || "BlinQ demo requests",
        bcc: to,
        replyTo: lead.email,
        subject: email.subject,
        text: email.text,
        html: email.html,
        helo: new URL(request.url).hostname,
      }),
      SMTP_TIMEOUT_MS
    );
  } catch (err) {
    // The reason goes to the logs only; the visitor gets a plain message.
    console.error("demo-request: email not sent:", err && err.message ? err.message : err);
    return json({ error: "Your request could not be sent. Try again shortly." }, 502);
  }
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: "Not allowed." }, 405);
}

/* ---------- Who sent it: Cloudflare's view of the connection plus what the form sent ---------- */

export function visitorContext(request, raw) {
  const m = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cf = request.cf || {};
  const header = (name, max) => text(request.headers.get(name), max);
  const num = (v, min, max) => {
    const n = Number(v);
    return Number.isFinite(n) && v !== null && v !== "" ? Math.min(max, Math.max(min, Math.round(n))) : null;
  };
  const list = (v, n, max) => (Array.isArray(v) ? v : []).map((x) => text(x, max)).filter(Boolean).slice(0, n);
  const utm = m.utm && typeof m.utm === "object" ? m.utm : {};
  const touch = num(m.touch, 0, 20) || 0;
  const ua = header("User-Agent", 400);
  const device = parseUserAgent(ua, { mobile: m.mobile === true, touch });
  return {
    ip: header("CF-Connecting-IP", 64),
    country: text(cf.country || request.headers.get("CF-IPCountry"), 2).toUpperCase(),
    city: text(cf.city, 60),
    region: text(cf.region, 60),
    postalCode: text(cf.postalCode, 20),
    ipTimeZone: text(cf.timezone, 60),
    network: text(cf.asOrganization, 80),
    userAgent: ua,
    browser: device.browser,
    os: device.os,
    deviceType: device.type,
    acceptLanguage: header("Accept-Language", 80).split(",")[0],
    screen: text(m.screen, 20),
    pixelRatio: num(m.dpr * 100, 50, 500),
    viewport: text(m.viewport, 20),
    touch,
    colorScheme: text(m.colorScheme, 10),
    connection: text(m.connection, 10),
    language: text(m.language, 40),
    timeZone: text(m.timezone, 60),
    localTime: text(m.localTime, 60),
    referrer: text(m.referrer, 300),
    landing: text(m.landing, 400),
    utm: {
      source: text(utm.source, 100),
      medium: text(utm.medium, 100),
      campaign: text(utm.campaign, 100),
      term: text(utm.term, 100),
      content: text(utm.content, 100),
    },
    clickIds: list(m.clickIds, 4, 20),
    timeOnPage: num(m.timeOnPage, 0, 86400),
    scrollDepth: num(m.scrollDepth, 0, 100),
    videoPlayed: m.videoPlayed === true,
    faqOpened: list(m.faqOpened, 6, 120),
    stagesViewed: list(m.stagesViewed, 5, 40),
    gpc: m.gpc === true,
  };
}

/* A plain reading of the browser's User-Agent; good enough for "Chrome 141 on Windows, desktop". */
function parseUserAgent(ua, hints) {
  const v = (re) => (ua.match(re) || [])[1] || "";
  let browser = "";
  if (/Edg(?:e|A|iOS)?\//.test(ua)) browser = "Edge " + v(/Edg(?:e|A|iOS)?\/(\d+)/);
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera " + v(/OPR\/(\d+)/);
  else if (/SamsungBrowser\//.test(ua)) browser = "Samsung Internet " + v(/SamsungBrowser\/(\d+)/);
  else if (/FxiOS\//.test(ua)) browser = "Firefox " + v(/FxiOS\/(\d+)/);
  else if (/CriOS\//.test(ua)) browser = "Chrome " + v(/CriOS\/(\d+)/);
  else if (/Firefox\//.test(ua)) browser = "Firefox " + v(/Firefox\/(\d+)/);
  else if (/Chrome\//.test(ua)) browser = "Chrome " + v(/Chrome\/(\d+)/);
  else if (/Safari\//.test(ua) && /Version\//.test(ua)) browser = "Safari " + v(/Version\/(\d+(?:\.\d+)?)/);

  let os = "";
  if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/.test(ua)) os = "Windows";
  else if (/iPhone/.test(ua)) os = "iOS " + v(/OS (\d+[_.]\d+)/).replace("_", ".");
  else if (/iPad/.test(ua)) os = "iPadOS " + v(/OS (\d+[_.]\d+)/).replace("_", ".");
  else if (/Android/.test(ua)) os = "Android " + v(/Android (\d+(?:\.\d+)?)/);
  else if (/CrOS/.test(ua)) os = "ChromeOS";
  else if (/Mac OS X/.test(ua)) os = hints.touch > 1 ? "iPadOS" : "macOS"; // iPads ask for desktop sites as a Mac
  else if (/Linux/.test(ua)) os = "Linux";

  let type = "Desktop";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua)) || /^iPadOS/.test(os)) type = "Tablet";
  else if (hints.mobile || /Mobi|iPhone|Android.*Mobile/.test(ua)) type = "Mobile";
  return { browser: browser.trim(), os: os.trim(), type: ua ? type : "" };
}

/* ---------- The email ---------- */

function countryName(code) {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}
function flag(code) {
  return /^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "T1"
    ? String.fromCodePoint(...[...code].map((c) => 127397 + c.charCodeAt(0)))
    : "";
}
function duration(s) {
  if (s == null) return "";
  if (s < 60) return s + " seconds";
  const m = Math.floor(s / 60);
  return m + (m === 1 ? " minute " : " minutes ") + (s % 60) + " seconds";
}
function receivedAt(date, timeZone) {
  const fmt = (tz) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: tz }).format(date);
  try {
    return timeZone ? fmt(timeZone) + " (" + timeZone + ")" : fmt("UTC") + " UTC";
  } catch {
    return fmt("UTC") + " UTC";
  }
}

export function buildEmail(lead, v, { received = new Date(), timeZone = "" } = {}) {
  const firstName = lead.name.split(" ")[0];
  const ipPlace = [v.city, v.region, countryName(v.country)].filter((x, i, a) => x && a.indexOf(x) === i).join(", ");
  const campaign = [v.utm.source, v.utm.medium, v.utm.campaign].filter(Boolean).join(" / ");
  const phoneHref = lead.phone ? "tel:" + lead.phone.replace(/[^\d+]/g, "") : "";
  const screen = v.screen ? v.screen + (v.pixelRatio && v.pixelRatio !== 100 ? " at " + v.pixelRatio / 100 + "x" : "") : "";
  const device = [v.deviceType, v.os].filter(Boolean).join(" · ");

  const sections = [
    ["Their details", [
      ["Name", lead.name],
      ["Email", lead.email, "mailto:" + lead.email],
      ["Phone", lead.phone, phoneHref],
      ["Business name", lead.business],
      ["Business type", lead.type],
      ["Country (chosen)", lead.country],
      ["Wants to improve", lead.priority],
      ["Agreed to be contacted", "Yes"],
    ]],
    ["How they found you", [
      ["Came from", v.referrer || "Direct visit (no referring site)"],
      ["Campaign", campaign],
      ["Keyword", v.utm.term],
      ["Ad content", v.utm.content],
      ["Ad click", v.clickIds.length ? "Yes (" + v.clickIds.join(", ") + ")" : ""],
      ["Landing page", v.landing || lead.page],
    ]],
    ["What they looked at", [
      ["Time on page", duration(v.timeOnPage)],
      ["Scrolled", v.scrollDepth != null ? v.scrollDepth + "% of the page" : ""],
      ["Played the video", v.screen ? (v.videoPlayed ? "Yes" : "No") : ""],
      ["Workflow stages opened", v.stagesViewed.join(", ")],
      ["FAQ questions opened", v.faqOpened.join(" | ")],
    ]],
    ["Visitor and device", [
      ["Location (from IP)", [flag(v.country), ipPlace].filter(Boolean).join(" ")],
      ["IP address", v.ip],
      ["Network", v.network],
      ["Device", device],
      ["Browser", v.browser],
      ["Screen", screen],
      ["Browser window", v.viewport],
      ["Language", v.language || v.acceptLanguage],
      ["Their time zone", v.timeZone || v.ipTimeZone],
      ["Their local time", v.localTime],
      ["Connection", v.connection],
      ["Colour scheme", v.colorScheme],
      ["Privacy signal", v.gpc ? "Global Privacy Control is on" : ""],
    ]],
  ].map(([title, rows]) => [title, rows.filter((r) => r[1])]).filter(([, rows]) => rows.length);

  const subject = "New demo request: " + lead.name + (lead.business ? ", " + lead.business : "");
  const where = countryName(v.country) || lead.country;
  const preheader = lead.name + (lead.business ? " from " + lead.business : "") + " wants a demo · " + lead.type + (where ? " · " + where : "");
  const when = receivedAt(received, timeZone);
  const site = lead.site ? "BlinQ leads site " + lead.site : "the BlinQ leads site";
  const note = "Location and device details come from the visitor's browser and IP address and may not be exact.";

  /* Plain text copy */
  const plain = [
    "New demo request from " + site,
    lead.name + (lead.business ? ", " + lead.business : "") + " · " + lead.type,
    "",
    ...sections.flatMap(([title, rows]) => [title, "-".repeat(title.length), ...rows.map(([l, val]) => (l + ":").padEnd(25) + val), ""]),
    "Received " + when + ".",
    "Reply to this email to answer " + firstName + " directly.",
    note,
  ].join("\n");

  /* HTML copy: table layout and inline styles so it looks right in Gmail, Outlook and phones */
  const e = escapeHtml;
  const F = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;";
  const rowHtml = ([label, val, href]) =>
    '<tr><td style="' + F + 'padding:9px 12px 9px 0;border-top:1px solid #EFEFF1;width:38%;vertical-align:top;font-size:13px;line-height:19px;color:#6B6B72;">' + e(label) + "</td>" +
    '<td style="' + F + 'padding:9px 0;border-top:1px solid #EFEFF1;vertical-align:top;font-size:14px;line-height:20px;color:#111114;word-break:break-word;">' +
    (href ? '<a href="' + e(href) + '" style="color:#D42B17;text-decoration:none;">' + e(val) + "</a>" : e(val)) + "</td></tr>";
  const sectionHtml = ([title, rows]) =>
    '<tr><td style="padding:24px 28px 0;">' +
    '<div style="' + F + 'font-size:13px;font-weight:700;color:#F0341F;padding-bottom:8px;">' + e(title) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' + rows.map(rowHtml).join("") + "</table>" +
    "</td></tr>";
  const chip = (t) => t ? '<span style="' + F + 'display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#F4F4F6;font-size:12px;line-height:16px;color:#3A3A40;">' + e(t) + "</span>" : "";
  const button = (href, label, primary) =>
    '<a href="' + e(href) + '" style="' + F + "display:inline-block;margin:0 8px 8px 0;padding:11px 18px;border-radius:8px;font-size:14px;font-weight:600;line-height:18px;text-decoration:none;" +
    (primary ? "background:#F0341F;color:#FFFFFF;border:1px solid #F0341F;" : "background:#FFFFFF;color:#111114;border:1px solid #DADADF;") + '">' + e(label) + "</a>";

  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>' + e(subject) + "</title></head>" +
    '<body style="margin:0;padding:0;background:#F2F2F4;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#F2F2F4;">' + e(preheader) + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F2F2F4;"><tr><td align="center" style="padding:24px 12px;">' +
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E4E4E8;border-radius:14px;border-collapse:separate;overflow:hidden;">' +
    // Header band
    '<tr><td style="background:#0A0A0A;padding:20px 28px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td style="' + F + 'font-size:24px;font-weight:800;letter-spacing:-0.5px;color:#FFFFFF;">Blin<span style="color:#F0341F;">Q</span></td>' +
    '<td align="right" style="' + F + 'font-size:13px;color:#9A9AA2;">Demo request</td>' +
    "</tr></table></td></tr>" +
    // Summary
    '<tr><td style="padding:28px 28px 4px;">' +
    '<div style="' + F + 'font-size:13px;font-weight:600;color:#F0341F;">New demo request</div>' +
    '<div style="' + F + 'margin-top:6px;font-size:26px;line-height:32px;font-weight:700;letter-spacing:-0.4px;color:#0A0A0A;">' + e(lead.name) + "</div>" +
    (lead.business ? '<div style="' + F + 'margin-top:2px;font-size:16px;line-height:22px;color:#3A3A40;">' + e(lead.business) + "</div>" : "") +
    '<div style="margin-top:14px;">' + chip(lead.type) + chip(lead.country) + chip(lead.priority) + "</div>" +
    '<div style="margin-top:10px;">' +
    button("mailto:" + lead.email + "?subject=" + encodeURIComponent("Your BlinQ demo"), "Reply to " + firstName, true) +
    (phoneHref ? button(phoneHref, "Call " + lead.phone, false) : "") +
    "</div></td></tr>" +
    // Details
    sections.map(sectionHtml).join("") +
    // Footer
    '<tr><td style="padding:26px 28px 28px;">' +
    '<div style="' + F + 'padding-top:16px;border-top:1px solid #EFEFF1;font-size:12px;line-height:18px;color:#8A8A92;">' +
    "Received " + e(when) + " from " + e(site) + ". Reply to this email to answer " + e(firstName) + " directly.<br>" + e(note) +
    "</div></td></tr>" +
    "</table></td></tr></table></body></html>";

  return { subject, preheader, text: plain, html };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/* ---------- Gmail SMTP over a Cloudflare TCP socket ---------- */

async function sendMail({ user, pass, fromName, bcc, replyTo, subject, text: plain, html, helo }) {
  const socket = connect({ hostname: "smtp.gmail.com", port: 465 }, { secureTransport: "on" });
  const reader = socket.readable.getReader();
  const writer = socket.writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  // One reply can span several lines ("250-..."); it ends at the line with a space after the code.
  const reply = async () => {
    for (;;) {
      let start = 0;
      let end;
      while ((end = buffer.indexOf("\r\n", start)) !== -1) {
        const line = buffer.slice(start, end);
        if (/^\d{3}(?: |$)/.test(line)) {
          const code = Number(line.slice(0, 3));
          // Every line of the reply without its "534-" prefixes, e.g. "5.7.9 Application-specific password required ..."
          const text = buffer.slice(0, end).split("\r\n").map((l) => l.slice(4)).join(" ");
          buffer = buffer.slice(end + 2);
          return { code, text };
        }
        start = end + 2;
      }
      const { value, done } = await reader.read();
      if (done) throw new Error("the mail server closed the connection");
      buffer += decoder.decode(value, { stream: true });
    }
  };
  const write = (data) => writer.write(encoder.encode(data));
  // `step` names the command in errors; the command itself (which may hold the password) is never logged.
  const step = async (name, command, codes) => {
    if (command !== null) await write(command + "\r\n");
    const r = await reply();
    if (!codes.includes(r.code)) throw new Error(name + " was refused (" + r.code + " " + r.text.slice(0, 240) + ")");
    return r;
  };

  try {
    await step("connection", null, [220]);
    await step("EHLO", "EHLO " + (helo || "localhost"), [250]);
    await step("login", "AUTH PLAIN " + base64("\u0000" + user + "\u0000" + pass), [235]);
    await step("MAIL FROM", "MAIL FROM:<" + user + ">", [250]);
    // Every recipient is a blind copy: they're given to the server here but never named in the headers.
    for (const rcpt of bcc) await step("RCPT TO", "RCPT TO:<" + rcpt + ">", [250, 251]);
    await step("DATA", "DATA", [354]);
    const domain = user.split("@")[1] || "localhost";
    const boundary = "blinq-" + crypto.randomUUID();
    const sender = encodeWords(fromName) + " <" + user + ">";
    const part = (type, content) =>
      "--" + boundary + "\r\n" +
      "Content-Type: " + type + '; charset="UTF-8"\r\n' +
      "Content-Transfer-Encoding: base64\r\n\r\n" +
      base64(content.replace(/\r?\n/g, "\r\n")).replace(/.{1,76}/g, "$&\r\n");
    const headers = [
      "From: " + sender,
      "To: " + sender, // the visible recipient is the sending address; the real recipients are BCC
      "Reply-To: " + replyTo,
      "Subject: " + encodeWords(subject),
      "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
      "Message-ID: <" + crypto.randomUUID() + "@" + domain + ">",
      "MIME-Version: 1.0",
      'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    ];
    const data =
      headers.join("\r\n") + "\r\n\r\n" +
      part("text/plain", plain) +
      part("text/html", html) +
      "--" + boundary + "--\r\n";
    // Dot-stuffing: a line starting with "." would end the message early.
    await step("message", data.replace(/(^|\r\n)\./g, "$1..") + ".", [250]);
    // The email is accepted at this point; say goodbye politely, but don't fail if the server just hangs up.
    await step("QUIT", "QUIT", [221]).catch(() => {});
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    try { socket.close(); } catch {}
  }
}

function base64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/* Header text: plain ASCII as it is, anything else as UTF-8 encoded-words of at most 75 characters. */
function encodeWords(s) {
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  const words = [];
  let chunk = "";
  for (const ch of s) {
    if (new TextEncoder().encode(chunk + ch).length > 45) {
      words.push(chunk);
      chunk = "";
    }
    chunk += ch;
  }
  if (chunk) words.push(chunk);
  return words.map((w) => "=?UTF-8?B?" + base64(w) + "?=").join("\r\n ");
}

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timed out after " + ms + " ms")), ms); }),
  ]).finally(() => clearTimeout(timer));
}

/* ---------- Checks (same approach as the main site's send-quote Function) ---------- */

/* Plain text only: control characters and line breaks out, cut to length. */
function text(value, max) {
  let s = String(value == null ? "" : value);
  s = s.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ");
  return s.trim().slice(0, max);
}

async function human(secret, token, ip) {
  if (!token || typeof token !== "string") return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  form.append("remoteip", ip);
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    const data = await r.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/* A light brake per visitor, kept in the edge cache: a few requests, then a pause. It only works
   on a custom domain, so Turnstile is the real protection. */
async function limited(url, ip) {
  if (typeof caches === "undefined" || !caches.default) return false;
  const key = new Request(new URL("/__demo-request-limit/" + encodeURIComponent(ip), url).toString());
  const hit = await caches.default.match(key);
  const count = hit ? Number(await hit.text()) || 0 : 0;
  if (count >= LIMIT) return true;
  await caches.default.put(key, new Response(String(count + 1), { headers: { "cache-control": "max-age=" + WINDOW_SECONDS } }));
  return false;
}
