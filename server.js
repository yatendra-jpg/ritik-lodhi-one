import express from "express";
import nodemailer from "nodemailer";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ================= CONFIG ================= */
const MAX_PER_HOUR = 28;
const PARALLEL = 3;
const DELAY_MIN = 120;
const DELAY_MAX = 220;

const usage = {};

/* ================= HELPERS ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (a,b)=>Math.floor(a+Math.random()*(b-a+1));

function resetIfNeeded(gmail){
  if(!usage[gmail]) usage[gmail]={count:0,start:Date.now()};
  if(Date.now()-usage[gmail].start>=3600000)
    usage[gmail]={count:0,start:Date.now()};
}

function normalizeContent(text){
  return text
    .replace(/\bfree\b/gi,"complimentary")
    .replace(/\boffer\b/gi,"proposal")
    .replace(/\bclick\b/gi,"review");
}

/* ================= ROUTES ================= */
app.get("/", (_, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

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

  const finalText =
    normalizeContent(message.trim()) +
    "\n\n📩\nScanned & Secured — www.Bitdefender.com";

  const transporter = nodemailer.createTransport({
    host:"smtp.gmail.com",
    port:465,
    secure:true,
    auth:{ user:gmail, pass:apppass }
  });

  try { await transporter.verify(); }
  catch {
    return res.json({success:false,msg:"Wrong App Password ❌",count:usage[gmail].count});
  }

  let sent = 0;

  for(let i=0;i<recipients.length;i+=PARALLEL){
    const batch = recipients.slice(i,i+PARALLEL);

    const jobs = batch.map(r=>({
      from:`"${senderName}" <${gmail}>`,
      to:r,
      subject,
      text:finalText,
      replyTo:gmail,
      headers:{
        "Message-ID": `<${crypto.randomUUID()}@${gmail.split("@")[1]}>`,
        "X-Mailer":"Secure Mail Console"
      }
    }));

    const result = await Promise.allSettled(
      jobs.map(j=>transporter.sendMail(j))
    );

    result.forEach(r=>r.status==="fulfilled" && sent++);
    await sleep(rand(DELAY_MIN,DELAY_MAX));
  }

  usage[gmail].count += sent;
  res.json({success:true,sent,count:usage[gmail].count});
});

app.listen(process.env.PORT||3000,()=>{
  console.log("✅ Secure Mail Console running");
});
