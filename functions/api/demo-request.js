/* Sends demo requests from the leads sites' "See it in action" form to a Gmail inbox.

   Runs on Cloudflare Pages as a Function at /api/demo-request, shared by every site in this
   repo (each form says which site it came from). The message goes out through Gmail's own SMTP
   server (smtp.gmail.com, port 465, TLS) using a Gmail app password, over Cloudflare's TCP
   sockets. No npm packages and no build step. Nothing is stored: each request is checked,
   emailed and forgotten.

   Variables (Cloudflare dashboard > Workers & Pages > this project > Settings > Variables and Secrets):
     GMAIL_USER          Text. The Gmail address that sends the email, e.g. leads@gmail.com.
     GMAIL_APP_PASSWORD  Secret. A Gmail app password for that address (myaccount.google.com/apppasswords).
     LEAD_TO             Optional. Where requests go: one address, or up to 10 separated by commas
                         (e.g. "sales@blinq.com.au, owner@gmail.com"). Defaults to GMAIL_USER.
     SEND_FROM_NAME      Optional. The sender name on the email. Defaults to "BlinQ demo requests".
     TURNSTILE_SITE_KEY  Optional, together with TURNSTILE_SECRET: turns on the Turnstile check.
     TURNSTILE_SECRET    Secret. Recommended once the form gets spam.

   Without GMAIL_USER and GMAIL_APP_PASSWORD the endpoint reports that sending is off, and the
   form shows a message with the support email address instead. */

import { connect } from "cloudflare:sockets";

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[A-Za-z]{2,}$/;
const MAX_BODY_BYTES = 20 * 1024;
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
  const to = String(env.LEAD_TO || user).split(",").map((s) => s.trim()).filter((s) => EMAIL.test(s)).slice(0, 10);
  if (!EMAIL.test(user) || !to.length) return json({ error: "Sending is not switched on for this site yet." }, 503);

  const subject = "New demo request: " + lead.name + (lead.business ? ", " + lead.business : "");
  const country = request.headers.get("CF-IPCountry") || "";
  try {
    await withTimeout(
      sendMail({
        user,
        pass: String(env.GMAIL_APP_PASSWORD).replace(/\s+/g, ""), // app passwords are often pasted with spaces
        fromName: text(env.SEND_FROM_NAME, 60) || "BlinQ demo requests",
        to,
        replyTo: lead.email,
        subject,
        body: message(lead, country),
        helo: new URL(request.url).hostname,
      }),
      SMTP_TIMEOUT_MS
    );
  } catch (err) {
    // The reason goes to the Function's logs only; the visitor gets a plain message.
    console.error("demo-request: email not sent:", err && err.message ? err.message : err);
    return json({ error: "Your request could not be sent. Try again shortly." }, 502);
  }
  return json({ ok: true });
}

export function onRequest() {
  return json({ error: "Not allowed." }, 405);
}

/* ---------- The email ---------- */

function message(lead, country) {
  const row = (label, value) => (label + ":").padEnd(20) + (value || "-");
  return [
    "New demo request from the BlinQ leads site" + (lead.site ? " " + lead.site : "") + ".",
    "",
    row("Business type", lead.type),
    row("Name", lead.name),
    row("Business name", lead.business),
    row("Email", lead.email),
    row("Phone", lead.phone),
    row("Country", lead.country),
    row("Wants to improve", lead.priority),
    row("Agreed to contact", "Yes"),
    "",
    row("Page", lead.page),
    row("Sent", new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC"),
    row("Visitor location", country),
    "",
    "Reply to this email to answer " + lead.name + " directly.",
  ].join("\n");
}

/* ---------- Gmail SMTP over a Cloudflare TCP socket ---------- */

async function sendMail({ user, pass, fromName, to, replyTo, subject, body, helo }) {
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
    for (const rcpt of to) await step("RCPT TO", "RCPT TO:<" + rcpt + ">", [250, 251]);
    await step("DATA", "DATA", [354]);
    const domain = user.split("@")[1] || "localhost";
    const headers = [
      "From: " + encodeWords(fromName) + " <" + user + ">",
      "To: " + to.join(", "),
      "Reply-To: " + replyTo,
      "Subject: " + encodeWords(subject),
      "Date: " + new Date().toUTCString().replace("GMT", "+0000"),
      "Message-ID: <" + crypto.randomUUID() + "@" + domain + ">",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
    ];
    const data = headers.join("\r\n") + "\r\n\r\n" + base64(body.replace(/\r?\n/g, "\r\n")).replace(/.{1,76}/g, "$&\r\n");
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
