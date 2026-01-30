/*********************************
 * FIREBASE CONFIG (v8 COMPAT)
 *********************************/
const firebaseConfig = {
  apiKey: "AIzaSyCoIcDhsABqCgepD2u6LBXX3vs2VoFDw2Y",
  authDomain: "greenguardai-a423c.firebaseapp.com",
  databaseURL:
    "https://greenguardai-a423c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "greenguardai-a423c",
  storageBucket: "greenguardai-a423c.appspot.com",
  messagingSenderId: "252743672688",
  appId: "1:252743672688:web:1ca494f4b84c037311e5b5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/*********************************
 * DASHBOARD DATA
 *********************************/
let energyVal = 0;
let airRawVal = 0;

// ENERGY (correct key)
db.ref("dashboard/energy").on("value", snap => {
  energyVal = Number(snap.val()) || 0;
  document.getElementById("energyValue").innerText =
    `${energyVal.toFixed(1)} W`;
  updateSmartSuggestions();
});

// AIR QUALITY
db.ref("dashboard/air_quality_raw").on("value", snap => {
  airRawVal = Number(snap.val()) || 0;
  document.getElementById("carbonValue").innerText =
    airRawVal.toFixed(2);
  updateSmartSuggestions();
});

/*********************************
 * ALERTS
 *********************************/
db.ref("dashboard/alerts")
  .limitToLast(5)
  .on("value", snap => {
    const list = document.getElementById("alertList");
    list.innerHTML = "";

    const alerts = snap.val();
    if (!alerts) {
      list.innerHTML = "<li>No alerts</li>";
      return;
    }

    Object.values(alerts).reverse().forEach(a => {
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

  if (energyVal > 1000)
    list.innerHTML += "<li>⚠ Reduce power usage</li>";

  if (airRawVal > 2.5)
    list.innerHTML += "<li>⚠ Improve ventilation</li>";

  if (!list.innerHTML)
    list.innerHTML = "<li>✅ All systems normal</li>";
}

/*********************************
 * AI CAMERA
 *********************************/
let video, canvas, ctx;
let cameraOn = false;
let pose, mpCamera;
let lastHumanDetected = 0;

async function startAICamera() {
  cameraOn = true;

  pose = new Pose({
    locateFile: file =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
  });

  pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
  });

  pose.onResults(onPoseResults);

  mpCamera = new Camera(video, {
    onFrame: async () => {
      if (cameraOn) await pose.send({ image: video });
    },
    width: 640,
    height: 480
  });

  await mpCamera.start();

  document.getElementById("predictionResult").innerText =
    "AI Monitoring Active";
}

function stopAICamera() {
  cameraOn = false;

  if (mpCamera) {
    mpCamera.stop();
    mpCamera = null;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById("predictionResult").innerText =
    "AI Camera Off";
}

/*********************************
 * POSE RESULTS
 *********************************/
function onPoseResults(results) {
  if (!cameraOn) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
      color: "#00ff00",
      lineWidth: 3
    });

    drawLandmarks(ctx, results.poseLandmarks, {
      color: "#ff0000",
      lineWidth: 2
    });

    const now = Date.now();
    if (now - lastHumanDetected > 30000) {
      lastHumanDetected = now;

      document.getElementById("predictionResult").innerText =
        "🧍 Human Detected";

      db.ref("dashboard/alerts").push({
        type: "Human Detected (AI)",
        time: new Date().toLocaleString()
      });
    }
  } else {
    document.getElementById("predictionResult").innerText =
      "No Human Detected";
  }
}

/*********************************
 * CAMERA TOGGLE
 *********************************/
function toggleCamera() {
  const btn = document.getElementById("toggleCamera");

  if (!cameraOn) {
    startAICamera();
    btn.innerText = "🔴 Stop Camera";
  } else {
    stopAICamera();
    btn.innerText = "🟢 Start Camera";
  }
}

/*********************************
 * DOM READY
 *********************************/
document.addEventListener("DOMContentLoaded", () => {
  video = document.getElementById("cameraStream");
  canvas = document.getElementById("poseCanvas");
  ctx = canvas.getContext("2d");

  document
    .getElementById("toggleCamera")
    .addEventListener("click", toggleCamera);
});
