// Cloudflare Pages Function: POST /api/contact
// Receives the contact form as JSON and emails it to the badger.
//
// HOW THE EMAIL PART WORKS (one-time setup in the Cloudflare dashboard):
//   Pages project -> Settings -> Functions -> Email bindings (or wrangler config):
//   add a Send Email binding named EMAIL with destination contact@honeybadger.software
//   (the address must be a verified Email Routing destination on this zone).
//   Until that binding exists, this function returns 503 and the contact page
//   automatically falls back to its Gmail / mailto / copy buttons - nothing breaks.

export async function onRequestPost(context) {
  let data;
  try {
    data = await context.request.json();
  } catch {
    return json({ ok: false, error: "bad-json" }, 400);
  }

  // Honeypot: the form hides a field humans never fill. Bots stuff every field.
  if (data.website) return json({ ok: true }, 200); // pretend success, drop it silently

  const name = (data.name || "").toString().slice(0, 120).trim();
  const email = (data.email || "").toString().slice(0, 200).trim();
  const topic = (data.topic || "General").toString().slice(0, 100).trim();
  const message = (data.message || "").toString().slice(0, 5000).trim();

  if (!name || !email.includes("@") || !message) {
    return json({ ok: false, error: "missing-fields" }, 400);
  }

  // No email binding configured yet -> tell the page to use its fallback buttons.
  if (!context.env.EMAIL) {
    return json({ ok: false, error: "email-binding-not-configured" }, 503);
  }

  // Build a plain-text email. Reply-To is the visitor, so hitting Reply in
  // Gmail answers THEM, not the website.
  const { EmailMessage } = await import("cloudflare:email");
  const raw =
    `From: Honeybadger Contact Form <no-reply@honeybadger.software>\r\n` +
    `To: contact@honeybadger.software\r\n` +
    `Reply-To: ${email}\r\n` +
    `Subject: [${topic}] from ${name} - honeybadger.software\r\n` +
    `Content-Type: text/plain; charset=utf-8\r\n\r\n` +
    `Name:  ${name}\r\nEmail: ${email}\r\nTopic: ${topic}\r\n\r\n${message}\r\n`;

  try {
    const msg = new EmailMessage(
      "no-reply@honeybadger.software",
      "contact@honeybadger.software",
      raw
    );
    await context.env.EMAIL.send(msg);
    return json({ ok: true }, 200);
  } catch (err) {
    return json({ ok: false, error: "send-failed" }, 502);
  }
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
