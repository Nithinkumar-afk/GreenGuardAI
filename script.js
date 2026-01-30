/*********************************
 * FIREBASE CONFIG (v8 COMPAT)
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
 * REAL-WORLD CONSTANTS
 *********************************/
const CO2_FACTOR = 0.82;              // kg CO₂ per kWh (India grid)
const TREE_CO2_YEAR = 21;             // kg CO₂ absorbed / tree / year
const BASELINE_POWER = 800;           // W (inefficient system reference)
const POWER_ALERT_THRESHOLD = 1000;   // W
const CO2_INTERVAL = 60000;           // 1 minute

/*********************************
 * LIVE STATE
 *********************************/
let powerW = 0;
let currentA = 0;
let aqi = 0;

let dailyCO2 = 0;
let weeklyCO2 = 0;

let co2History = [];
let activeMinutesToday = 0;
let lastPowerAlert = 0;

/*********************************
 * LOAD STORED DATA
 *********************************/
db.ref("dashboard/co2").once("value", snap => {
  if (!snap.exists()) return;
  const d = snap.val();
  dailyCO2 = d.daily || 0;
  weeklyCO2 = d.weekly || 0;
});

/*********************************
 * POWER INPUT (ESP32)
 *********************************/
db.ref("dashboard/power").on("value", snap => {
  powerW = Number(snap.val()) || 0;
  document.getElementById("energyValue").innerText =
    `${powerW.toFixed(1)} W`;

  checkHighPowerAlert();
  renderDashboard();
});

/*********************************
 * CURRENT INPUT
 *********************************/
db.ref("dashboard/current").on("value", snap => {
  currentA = Number(snap.val()) || 0;
});

/*********************************
 * AIR QUALITY (MQ135)
 *********************************/
db.ref("dashboard/aqi").on("value", snap => {
  aqi = Number(snap.val()) || 0;
  document.getElementById("carbonValue").innerText = aqi;
  renderDashboard();
});

/*********************************
 * CO₂ CALCULATION (POWER → EMISSIONS)
 *********************************/
setInterval(() => {
  if (powerW <= 0) return;

  activeMinutesToday++;

  const kWh = (powerW / 1000) * (1 / 60);
  const co2 = kWh * CO2_FACTOR;

  dailyCO2 += co2;
  weeklyCO2 += co2;

  co2History.push(co2);
  if (co2History.length > 1440) co2History.shift(); // 1 day history

  db.ref("dashboard/co2").set({
    daily: Number(dailyCO2.toFixed(4)),
    weekly: Number(weeklyCO2.toFixed(4)),
    updated: Date.now()
  });

  renderDashboard();
}, CO2_INTERVAL);

/*********************************
 * DASHBOARD CORE LOGIC
 *********************************/
function renderDashboard() {

  /* 🌍 LIVE CO₂ */
  document.getElementById("co2Live").innerText =
    `${dailyCO2.toFixed(2)} kg today`;

  document.getElementById("dailyCO2").innerText =
    `Daily: ${dailyCO2.toFixed(2)} kg`;

  document.getElementById("weeklyCO2").innerText =
    `Weekly: ${weeklyCO2.toFixed(2)} kg`;

  /* 🌱 TREES SAVED (REAL LOGIC) */
  const baselineCO2 =
    ((BASELINE_POWER / 1000) * (activeMinutesToday / 60)) * CO2_FACTOR;

  const savedCO2 = Math.max(0, baselineCO2 - dailyCO2);
  const treesSaved = savedCO2 / (TREE_CO2_YEAR / 365);

  document.getElementById("treesSaved").innerText =
    treesSaved.toFixed(2);

  /* 🧠 NEXT-DAY CO₂ PREDICTION */
  const avgMinuteCO2 =
    co2History.length
      ? co2History.reduce((a, b) => a + b, 0) / co2History.length
      : 0;

  const predictedTomorrow = avgMinuteCO2 * 1440;
  document.getElementById("predictedCO2").innerText =
    `${predictedTomorrow.toFixed(2)} kg`;

  /* 🏆 ECO SCORE (STRICT) */
  let eco = 100;
  eco -= Math.min(40, powerW / 25);
  eco -= Math.min(30, aqi / 8);
  eco -= Math.min(30, dailyCO2 * 5);
  eco = Math.max(0, Math.round(eco));

  document.getElementById("ecoScore").innerText =
    `${eco}/100`;

  /* 🌍 SDG SCORE (SDG-13 / SDG-7) */
  const sdgScore = Math.max(
    0,
    Math.min(100, Math.round((eco * 0.75) + (100 - dailyCO2 * 12)))
  );

  document.getElementById("sdgScore").innerText =
    `${sdgScore}/100`;

  updateSmartSuggestions();
}

/*********************************
 * POWER ALERT SYSTEM
 *********************************/
function checkHighPowerAlert() {
  const now = Date.now();
  if (
    powerW > POWER_ALERT_THRESHOLD &&
    now - lastPowerAlert > 10 * 60 * 1000
  ) {
    lastPowerAlert = now;
    db.ref("dashboard/alerts").push({
      type: "⚡ High Power Consumption",
      value: powerW.toFixed(1) + " W",
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

    if (!snap.exists()) {
      list.innerHTML = "<li>No alerts</li>";
      return;
    }

    Object.values(snap.val()).reverse().forEach(a => {
      const li = document.createElement("li");
      li.innerHTML = `
        <strong>${a.type}</strong><br>
        <small>${a.value || ""}</small><br>
        <small>${a.time}</small>
      `;
      list.appendChild(li);
    });
  });

/*********************************
 * SMART SUGGESTIONS
 *********************************/
function updateSmartSuggestions() {
  const list = document.getElementById("suggestionList");
  list.innerHTML = "";

  if (powerW > POWER_ALERT_THRESHOLD)
    list.innerHTML += "<li>⚠ Reduce load to cut CO₂ emissions</li>";

  if (aqi > 150)
    list.innerHTML += "<li>⚠ Poor air quality detected</li>";

  if (!list.innerHTML)
    list.innerHTML = "<li>✅ System operating sustainably</li>";
}

/*********************************
 * CO₂ POPUP CONTROLS
 *********************************/
function openCO2Popup() {
  document.getElementById("co2Popup").style.display = "block";
}
function closeCO2Popup() {
  document.getElementById("co2Popup").style.display = "none";
}
