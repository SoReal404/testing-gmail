const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const fileUpload = require("express-fileupload");
const nodemailer = require("nodemailer");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload());

app.use(express.static(path.join(__dirname, "../public")));

// === Tracking Database ===
const TRACK_FILE = "./tracking.json";
if (!fs.existsSync(TRACK_FILE)) fs.writeFileSync(TRACK_FILE, "{}");

function saveTrack(email, type) {
  const db = JSON.parse(fs.readFileSync(TRACK_FILE));
  if (!db[email]) {
    db[email] = { opens: 0, clicks: 0, last_event: null };
  }

  if (type === "open") db[email].opens++;
  if (type === "click") db[email].clicks++;

  db[email].last_event = new Date().toISOString();
  
  fs.writeFileSync(TRACK_FILE, JSON.stringify(db, null, 2));
}

// === Tracking Pixel ===
app.get("/open.png", (req, res) => {
  const email = req.query.email;
  if (email) saveTrack(email, "open");

  const img = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQI12P4z8DwHwAEvwJ/7b9FwQAAAABJRU5ErkJggg==", "base64");
  
  res.setHeader("Content-Type", "image/png");
  res.send(img);
});

// === Click Tracking ===
app.get("/click", (req, res) => {
  const { email, url } = req.query;
  if (email) saveTrack(email, "click");
  res.redirect(url);
});

// === Dashboard ===
app.get("/dashboard", (req, res) => {
  const db = JSON.parse(fs.readFileSync(TRACK_FILE));
  let html = `<h1>Email Tracking Dashboard</h1>
  <table border='1' cellpadding='8'>
  <tr><th>Email</th><th>Opens</th><th>Clicks</th><th>Last Event</th></tr>`;

  for (const email in db) {
    html += `<tr>
      <td>${email}</td>
      <td>${db[email].opens}</td>
      <td>${db[email].clicks}</td>
      <td>${db[email].last_event}</td>
    </tr>`;
  }

  html += "</table>";
  res.send(html);
});

// === Email Sending ===
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
});

function wrapTracking(body, email) {
  return body
    .replace(/{{email}}/g, email)
    .replace(/{{track_open}}/g, `<img src="http://localhost:3000/open.png?email=${email}" width="1" height="1">`)
    .replace(/{{track_click:([^}]+)}}/g, (m, url) => {
      return `http://localhost:3000/click?email=${email}&url=${encodeURIComponent(url)}`;
    });
}

app.post("/send", async (req, res) => {
  try {
    const { emailsText, subject, body } = req.body;
    let emails = [];

    // Textarea emails
    if (emailsText) {
      emails = emailsText.split(/[\n,]+/).map(e => e.trim()).filter(e => e);
    }

    // CSV upload
    if (req.files && req.files.csvFile) {
      const tempPath = "./temp.csv";
      await req.files.csvFile.mv(tempPath);
      const rows = [];
      fs.createReadStream(tempPath)
        .pipe(csv())
        .on("data", row => rows.push(row))
        .on("end", async () => {
          rows.forEach(r => emails.push(r.email || Object.values(r)[0]));
          fs.unlinkSync(tempPath);
          await sendAll();
        });
    } else {
      await sendAll();
    }

    async function sendAll() {
      for (const email of emails) {
        const html = wrapTracking(body, email);
        await transporter.sendMail({
          from: process.env.GMAIL_USER,
          to: email,
          subject: subject.replace(/{{email}}/g, email),
          html
        });
      }
      res.json({ success: true });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
