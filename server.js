import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= ROOT SAFE HANDLER ================= */
app.get("/", (_, res) => {
  const loginPath = path.join(__dirname, "public", "login.html");
  const indexPath = path.join(__dirname, "public", "index.html");

  if (fs.existsSync(loginPath)) {
    return res.sendFile(loginPath);
  }
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }

  res.status(500).send("Login file not found ❌");
});

/* ================= SAFE CONFIG ================= */
const MAX_PER_HOUR = 28;
const PARALLEL = 3;
const DELAY_MIN = 120;
const DELAY_MAX = 220;

const usage = {};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a,b)=>Math.floor(a+Math.random()*(b-a+1));

function resetIfNeeded(gmail){
  if(!usage[gmail]) usage[gmail]={count:0,start:Date.now()};
  if(Date.now()-usage[gmail].start>=3600000)
    usage[gmail]={count:0,start:Date.now()};
}

function normalize(text){
  return text
    .replace(/\bfree\b/gi,"available")
    .replace(/\boffer\b/gi,"details");
}

const FOOTER = "📩 Sent via a secure email system.";

/* ================= SEND ================= */
app.post("/send", async (req,res)=>{
  const { senderName,gmail,apppass,subject,message,to } = req.body;

  if(!gmail || !apppass || !subject || !message || !to)
    return res.json({success:false,msg:"Missing fields ❌"});

  resetIfNeeded(gmail);

  if(usage[gmail].count>=MAX_PER_HOUR)
    return res.json({success:false,msg:"Mail Limit Full ❌",count:usage[gmail].count});

  const recipients = to.split(/,|\r?\n/).map(v=>v.trim()).filter(Boolean);

  if(usage[gmail].count + recipients.length > MAX_PER_HOUR)
    return res.json({success:false,msg:"Mail Limit Full ❌",count:usage[gmail].count});

  const finalText = normalize(message.trim()) + "\n\n" + FOOTER;

  const transporter = nodemailer.createTransport({
    host:"smtp.gmail.com",
    port:465,
    secure:true,
    auth:{ user:gmail, pass:apppass }
  });

  try{ await transporter.verify(); }
  catch{
    return res.json({success:false,msg:"Wrong App Password ❌",count:usage[gmail].count});
  }

  let sent=0;

  for(let i=0;i<recipients.length;i+=PARALLEL){
    const batch = recipients.slice(i,i+PARALLEL);

    const jobs = batch.map(r=>({
      from:`"${senderName}" <${gmail}>`,
      to:r,
      subject,
      text:finalText,
      replyTo:gmail,
      headers:{
        "Message-ID": `<${crypto.randomUUID()}@${gmail.split("@")[1]}>`
      }
    }));

    const results = await Promise.allSettled(
      jobs.map(j=>transporter.sendMail(j))
    );

    results.forEach(r=>r.status==="fulfilled" && sent++);
    await sleep(rand(DELAY_MIN,DELAY_MAX));
  }

  usage[gmail].count += sent;
  res.json({success:true,sent,count:usage[gmail].count});
});

/* ================= START ================= */
app.listen(process.env.PORT || 3000, () => {
  console.log("✅ Safe Mail Server running");
});
