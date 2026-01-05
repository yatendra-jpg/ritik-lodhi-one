import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

/* ================= BASIC SETUP ================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ROOT */
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* ================= SAFE CONFIG ================= */
const MAX_PER_HOUR = 28;        // hard safe limit
const PARALLEL = 3;             // same speed, no burst
const DELAY_MIN = 120;          // ms
const DELAY_MAX = 220;          // ms

const usage = {};               // gmail -> { count, start }

/* ================= HELPERS ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

function resetIfNeeded(gmail) {
  if (!usage[gmail]) {
    usage[gmail] = { count: 0, start: Date.now() };
    return;
  }
  if (Date.now() - usage[gmail].start >= 60 * 60 * 1000) {
    usage[gmail] = { count: 0, start: Date.now() };
  }
}

/* Light content normalization (legal, inbox-friendly) */
function normalizeContent(text) {
  return text
    .replace(/\bfree\b/gi, "complimentary")
    .replace(/\boffer\b/gi, "proposal")
    .replace(/\bclick\b/gi, "review");
}

/* ================= FOOTER ================= */
const FOOTER = "📩 Scanned & Secured —  www.avast.com";

/* ================= SEND MAIL ================= */
app.post("/send", async (req, res) => {
  const { senderName, gmail, apppass, subject, message, to } = req.body;

  if (!gmail || !apppass || !subject || !message || !to) {
    return res.json({ success: false, msg: "Missing fields ❌" });
  }

  resetIfNeeded(gmail);

  if (usage[gmail].count >= MAX_PER_HOUR) {
    return res.json({
      success: false,
      msg: "Mail Limit Full ❌",
      count: usage[gmail].count
    });
  }

  const recipients = to
    .split(/,|\r?\n/)
    .map(v => v.trim())
    .filter(Boolean);

  if (usage[gmail].count + recipients.length > MAX_PER_HOUR) {
    return res.json({
      success: false,
      msg: "Mail Limit Full ❌",
      count: usage[gmail].count
    });
  }

  const finalText =
    normalizeContent(message.trim()) +
    "\n\n" +
    FOOTER;

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: gmail,
      pass: apppass
    }
  });

  try {
    await transporter.verify();
  } catch {
    return res.json({
      success: false,
      msg: "Wrong App Password ❌",
      count: usage[gmail].count
    });
  }

  let sent = 0;

  for (let i = 0; i < recipients.length; i += PARALLEL) {
    const batch = recipients.slice(i, i + PARALLEL);

    const jobs = batch.map(r => ({
      from: `"${senderName}" <${gmail}>`,
      to: r,
      subject,
      text: finalText,
      replyTo: gmail,
      headers: {
        "Message-ID": `<${crypto.randomUUID()}@${gmail.split("@")[1]}>`,
        "X-Mailer": "Secure Mail Console"
      }
    }));

    const results = await Promise.allSettled(
      jobs.map(j => transporter.sendMail(j))
    );

    results.forEach(r => r.status === "fulfilled" && sent++);
    await sleep(rand(DELAY_MIN, DELAY_MAX));
  }

  usage[gmail].count += sent;

  res.json({
    success: true,
    sent,
    count: usage[gmail].count
  });
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Secure Mail Server running");
});
