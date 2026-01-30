/*********************************
 * FIREBASE CONFIG (v8)
 *********************************/
const firebaseConfig = {
  apiKey: "AIzaSyCoIcDhsABqCgepD2u6LBXX3vs2VoFDw2Y",
  authDomain: "greenguardai-a423c.firebaseapp.com",
  databaseURL: "https://greenguardai-a423c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "greenguardai-a423c",
  storageBucket: "greenguardai-a423c.appspot.com",
  messagingSenderId: "252743672688",
  appId: "1:252743672688:web:1ca494f4b84c037311e5b5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/*********************************
 * CONSTANTS (REALISTIC)
 *********************************/
const CO2_FACTOR = 0.82;          // kg CO₂ / kWh (India avg)
const TREE_CO2_YEAR = 21;         // kg CO₂ absorbed per tree per year
const BASELINE_POWER = 800;       // W
const POWER_ALERT_THRESHOLD = 1000;
const CO2_INTERVAL = 60000;       // 1 min

/*********************************
 * STATE
 *********************************/
let energyVal = 0;
let airRawVal = 0;

let dailyCO2 = 0;
let weeklyCO2 = 0;

let co2History = [];
let lastPowerAlert = 0;
let activeMinutesToday = 0;

/*********************************
 * LOAD STORED CO₂
 *********************************/
db.ref("dashboard/co2").once("value", snap => {
  const d = snap.val();
  if (!d) return;
  dailyCO2 = d.daily || 0;
  weeklyCO2 = d.weekly || 0;
});

/*********************************
 * ENERGY INPUT
 *********************************/
db.ref("dashboard/energy").on("value", snap => {
  energyVal = Number(snap.val()) || 0;
  document.getElementById("energyValue").innerText =
    `${energyVal.toFixed(1)} W`;

  checkHighPowerAlert();
  renderDashboard();
});

/*********************************
 * AIR QUALITY (RELATIVE INDEX)
 *********************************/
db.ref("dashboard/air_quality_raw").on("value", snap => {
  airRawVal = Number(snap.val()) || 0;
  document.getElementById("carbonValue").innerText =
    airRawVal.toFixed(2);

  renderDashboard();
});

/*********************************
 * CO₂ ACCUMULATION
 *********************************/
setInterval(() => {
  if (energyVal <= 0) return;

  activeMinutesToday++;

  const kWh = (energyVal / 1000) * (1 / 60);
  const co2 = kWh * CO2_FACTOR;

  dailyCO2 += co2;
  weeklyCO2 += co2;

  co2History.push(co2);
  if (co2History.length > 120) co2History.shift();

  db.ref("dashboard/co2").set({
    daily: Number(dailyCO2.toFixed(4)),
    weekly: Number(weeklyCO2.toFixed(4))
  });

  renderDashboard();
}, CO2_INTERVAL);

/*********************************
 * DASHBOARD LOGIC
 *********************************/
function renderDashboard() {

  /* 🌍 LIVE CO₂ */
  document.getElementById("co2Live").innerText =
    `${dailyCO2.toFixed(2)} kg today`;

  document.getElementById("dailyCO2").innerText =
    `Daily: ${dailyCO2.toFixed(2)} kg`;

  document.getElementById("weeklyCO2").innerText =
    `Weekly: ${weeklyCO2.toFixed(2)} kg`;

  /* 🌱 TREES SAVED (REALISTIC) */
  const baselineCO2 =
    ((BASELINE_POWER / 1000) * (activeMinutesToday / 60)) * CO2_FACTOR;

  const savedCO2 = Math.max(0, baselineCO2 - dailyCO2);
  const treesSaved =
    savedCO2 / (TREE_CO2_YEAR / 365);

  document.getElementById("treesSaved").innerText =
    treesSaved.toFixed(2);

  /* 🧠 NEXT DAY PREDICTION */
  const avgMinuteCO2 =
    co2History.length > 10
      ? co2History.reduce((a, b) => a + b, 0) / co2History.length
      : 0;

  const predictedTomorrow = avgMinuteCO2 * 1440;

  document.getElementById("predictedCO2").innerText =
    `${predictedTomorrow.toFixed(2)} kg`;

  /* 🏆 ECO SCORE (0–100) */
  let eco = 100;
  eco -= Math.min(30, energyVal / 35);
  eco -= Math.min(25, airRawVal * 6); // relative pollution index
  eco -= Math.min(25, dailyCO2 * 4);

  eco = Math.max(0, Math.round(eco));
  document.getElementById("ecoScore").innerText =
    `${eco}/100`;

  /* 🌍 SDG SCORE */
  const sdgScore =
    Math.max(0, Math.round((eco * 0.6) + (100 - dailyCO2 * 8)));

  document.getElementById("sdgScore").innerText =
    `${sdgScore}/100`;

  updateSmartSuggestions();
}

/*********************************
 * ALERTS
 *********************************/
function checkHighPowerAlert() {
  const now = Date.now();
  if (
    energyVal > POWER_ALERT_THRESHOLD &&
    now - lastPowerAlert > 10 * 60 * 1000
  ) {
    lastPowerAlert = now;
    db.ref("dashboard/alerts").push({
      type: "⚡ High Power Consumption",
      time: new Date().toLocaleString()
    });
  }
}

/*********************************
 * ALERT DISPLAY
 *********************************/
db.ref("dashboard/alerts")
  .limitToLast(5)
  .on("value", snap => {
    const list = document.getElementById("alertList");
    list.innerHTML = "";

    if (!snap.val()) {
      list.innerHTML = "<li>No alerts</li>";
      return;
    }

    Object.values(snap.val()).reverse().forEach(a => {
      const li = document.createElement("li");
      li.innerHTML = `${a.type}<br><small>${a.time}</small>`;
      list.appendChild(li);
    });
  });

/*********************************
 * SMART SUGGESTIONS
 *********************************/
function updateSmartSuggestions() {
  const list = document.getElementById("suggestionList");
  list.innerHTML = "";

  if (energyVal > POWER_ALERT_THRESHOLD)
    list.innerHTML += "<li>⚠ Reduce electrical load to cut CO₂</li>";

  if (airRawVal > 2.5)
    list.innerHTML += "<li>⚠ Improve ventilation / reduce pollutants</li>";

  if (!list.innerHTML)
    list.innerHTML = "<li>✅ System operating sustainably</li>";
}

/*********************************
 * CO₂ POPUP
 *********************************/
function openCO2Popup() {
  document.getElementById("co2Popup").style.display = "block";
}
function closeCO2Popup() {
  document.getElementById("co2Popup").style.display = "none";
}

/*********************************
 * AI CAMERA (UNCHANGED)
 *********************************/
let video, canvas, ctx;
let cameraOn = false;

document.addEventListener("DOMContentLoaded", () => {
  video = document.getElementById("cameraStream");
  canvas = document.getElementById("poseCanvas");
  ctx = canvas.getContext("2d");

  document.getElementById("toggleCamera")
    .addEventListener("click", () =>
      cameraOn ? stopAICamera() : startAICamera()
    );
});
