/*********************************
 * FIREBASE CONFIG
 *********************************/
const firebaseConfig = {
  apiKey: "AIzaSyCoIcDhsABqCgepD2u6LBXX3vs2VoFDw2Y",
  authDomain: "greenguardai-a423c.firebaseapp.com",
  databaseURL: "https://greenguardai-a423c-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "greenguardai-a423c",
  storageBucket: "greenguardai-a423c.firebasestorage.app",
  messagingSenderId: "252743672688",
  appId: "1:252743672688:web:1ca494f4b84c037311e5b5",
  measurementId: "G-L7VZSFLMNZ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

/*********************************
 * DASHBOARD DATA
 *********************************/
let energyVal = 0;
let co2Val = 0;

db.ref("dashboard/energy").on("value", (s) => {
  energyVal = s.val() || 0;
  document.getElementById("energyValue").innerText = `${energyVal} W`;
  updateSmartSuggestions();
});

db.ref("dashboard/co2").on("value", (s) => {
  co2Val = s.val() || 0;
  document.getElementById("carbonValue").innerText = `${co2Val} kg CO₂`;
  updateSmartSuggestions();
});

db.ref("dashboard/alerts").on("value", (s) => {
  const alerts = s.val() || {};
  document.getElementById("alertList").innerHTML =
    Object.values(alerts)
      .map(a => `<li>${a.type} – <small>${a.time}</small></li>`)
      .join("");
});

/*********************************
 * SMART SUGGESTIONS
 *********************************/
function updateSmartSuggestions() {
  const list = document.getElementById("suggestionList");
  list.innerHTML = "";

  if (energyVal > 1000) {
    list.innerHTML += "<li>Reduce energy usage during peak hours.</li>";
  }
  if (co2Val > 10) {
    list.innerHTML += "<li>Check machinery for emission inefficiency.</li>";
  }
  if (!list.innerHTML) {
    list.innerHTML = "<li>All systems optimized ✅</li>";
  }
}

/*********************************
 * AI HUMAN DETECTION (MEDIAPIPE)
 *********************************/
let video;
let stream;
let cameraOn = false;
let pose;
let lastHumanAlert = 0;

/* ✅ NEW: CANVAS VARIABLES */
let canvas;
let ctx;

async function startAICamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    cameraOn = true;

    pose = new Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6
    });

    pose.onResults(onPoseResults);

    const camera = new Camera(video, {
      onFrame: async () => {
        if (cameraOn) {
          await pose.send({ image: video });
        }
      },
      width: 320,
      height: 240
    });

    camera.start();

    document.getElementById("predictionResult").innerText =
      "AI Human Detection Running...";
  } catch (err) {
    alert("Camera permission denied");
    console.error(err);
  }
}

function stopAICamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    video.srcObject = null;
  }
  cameraOn = false;

  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  document.getElementById("predictionResult").innerText =
    "AI Camera Stopped.";
}

/*********************************
 * POSE RESULTS + DRAWING
 *********************************/
function onPoseResults(results) {
  if (!cameraOn) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (results.poseLandmarks) {
    drawConnectors(
      ctx,
      results.poseLandmarks,
      POSE_CONNECTIONS,
      { color: "#00FF00", lineWidth: 3 }
    );

    drawLandmarks(
      ctx,
      results.poseLandmarks,
      { color: "#FF0000", lineWidth: 2 }
    );
  }

  const now = Date.now();

  if (results.poseLandmarks && results.poseLandmarks.length > 0) {
    if (now - lastHumanAlert > 8000) {
      lastHumanAlert = now;

      document.getElementById("predictionResult").innerText =
        "🧍 Human Detected";

      db.ref("dashboard/alerts").push({
        type: "Human Detected (AI Verified)",
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
    btn.innerText = "🔴 Turn Off Camera";
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

  /* ✅ CANVAS INIT */
  canvas = document.getElementById("poseCanvas");
  ctx = canvas.getContext("2d");

  document
    .getElementById("toggleCamera")
    .addEventListener("click", toggleCamera);
});
