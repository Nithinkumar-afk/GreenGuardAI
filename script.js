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
 * DASHBOARD DATA
 *********************************/
let powerVal = 0;
let airRawVal = 0;

db.ref("dashboard/power").on("value", snap => {
  powerVal = snap.val() ?? 0;
  document.getElementById("energyValue").innerText = `${powerVal.toFixed(1)} W`;
  updateSmartSuggestions();
});

db.ref("dashboard/air_quality_raw").on("value", snap => {
  airRawVal = snap.val() ?? 0;
  document.getElementById("carbonValue").innerText = airRawVal.toFixed(0);
  updateSmartSuggestions();
});

/*********************************
 * ALERTS
 *********************************/
db.ref("dashboard/alerts")
  .limitToLast(5)
  .on("value", snap => {
    const alerts = snap.val() || {};
    document.getElementById("alertList").innerHTML =
      Object.values(alerts)
        .map(a => `<li>${a.type}<br><small>${a.time}</small></li>`)
        .join("") || "<li>No alerts</li>";
  });

/*********************************
 * SMART SUGGESTIONS
 *********************************/
function updateSmartSuggestions() {
  const list = document.getElementById("suggestionList");
  list.innerHTML = "";

  if (powerVal > 1000)
    list.innerHTML += "<li>⚠ High power usage detected</li>";

  if (airRawVal > 2000)
    list.innerHTML += "<li>⚠ Poor air quality detected</li>";

  if (!list.innerHTML)
    list.innerHTML = "<li>✅ All systems normal</li>";
}

/*********************************
 * AI CAMERA VARIABLES
 *********************************/
let video, canvas, ctx;
let stream = null;
let cameraOn = false;
let pose = null;
let mpCamera = null;
let lastHumanAlert = 0;

/*********************************
 * START AI CAMERA
 *********************************/
async function startAICamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

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
      width: 320,
      height: 240
    });

    cameraOn = true;
    mpCamera.start();

    document.getElementById("predictionResult").innerText =
      "AI Monitoring Active";

  } catch (err) {
    alert("Camera access denied");
    console.error(err);
  }
}

/*********************************
 * STOP AI CAMERA
 *********************************/
function stopAICamera() {
  cameraOn = false;

  if (mpCamera) {
    mpCamera.stop();
    mpCamera = null;
  }

  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }

  if (ctx)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

  document.getElementById("predictionResult").innerText =
    "AI Camera Off";
}

/*********************************
 * POSE RESULTS
 *********************************/
function onPoseResults(results) {
  if (!cameraOn || !results.image || !ctx) return;

  canvas.width = results.image.width;
  canvas.height = results.image.height;
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
    if (now - lastHumanAlert > 15000) {
      lastHumanAlert = now;

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
    btn.innerText = "🟢 Turn On Camera";
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
