const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Make folders for saving data
if (!fs.existsSync("./logs")) fs.mkdirSync("./logs");
if (!fs.existsSync("./logs/opens.json")) fs.writeFileSync("./logs/opens.json", "[]");
if (!fs.existsSync("./logs/clicks.json")) fs.writeFileSync("./logs/clicks.json", "[]");

function saveLog(file, data) {
  const logs = JSON.parse(fs.readFileSync(file));
  logs.push(data);
  fs.writeFileSync(file, JSON.stringify(logs, null, 2));
}

// ----------------------------------------
// OPEN TRACKING (PIXEL)
// ----------------------------------------
app.get("/track/open", (req, res) => {
  const email = req.query.email || "unknown";
  const time = new Date().toISOString();

  saveLog("./logs/opens.json", { email, time });

  const pixel = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4////fwAJ+wP7uBqvWQAAAABJRU5ErkJggg==",
    "base64"
  );

  res.setHeader("Content-Type", "image/png");
  res.send(pixel);
});

// ----------------------------------------
// CLICK TRACKING
// ----------------------------------------
app.get("/track/click", (req, res) => {
  const email = req.query.email || "unknown";
  const url = req.query.url;
  const time = new Date().toISOString();

  if (!url) return res.send("Missing URL");

  saveLog("./logs/clicks.json", { email, url, time });

  return res.redirect(url);
});

// ----------------------------------------
// DASHBOARD ENDPOINT
// ----------------------------------------
app.get("/dashboard", (req, res) => {
  const opens = JSON.parse(fs.readFileSync("./logs/opens.json"));
  const clicks = JSON.parse(fs.readFileSync("./logs/clicks.json"));

  res.json({
    total_opens: opens.length,
    total_clicks: clicks.length,
    opens,
    clicks,
  });
});

// ----------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Tracking server running on port", PORT));
