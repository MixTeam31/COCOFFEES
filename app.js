const videoPlayer = document.getElementById("videoPlayer");
const statusMessage = document.getElementById("status");

let videos = [];
let currentIndex = 0;
let wakeLock = null;

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.style.display = "block";
}

function hideStatus() {
  statusMessage.style.display = "none";
}

async function loadVideoList() {
  try {
    const response = await fetch("./videos.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Impossible de charger videos.json : ${response.status}`);
    }

    const list = await response.json();

    if (!Array.isArray(list) || list.length === 0) {
      throw new Error("La liste des vidéos est vide.");
    }

    videos = list;
  } catch (error) {
    console.error(error);
    showStatus("Erreur : impossible de charger la liste des vidéos.");
  }
}

async function playVideo(index) {
  if (videos.length === 0) {
    return;
  }

  currentIndex = index;

  videoPlayer.src = videos[currentIndex];
  videoPlayer.load();

  try {
    await videoPlayer.play();
    hideStatus();
  } catch (error) {
    console.error("Lecture automatique bloquée :", error);
    showStatus("La lecture automatique est bloquée par le navigateur.");
  }
}

function playNextVideo() {
  currentIndex = (currentIndex + 1) % videos.length;
  playVideo(currentIndex);
}

async function requestFullscreen() {
  try {
    if (document.fullscreenElement) {
      return;
    }

    if (document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide"
      });
    }
  } catch (error) {
    console.warn(
      "Le plein écran automatique est bloqué par le navigateur.",
      error
    );
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.warn("Wake Lock non disponible.");
    return;
  }

  try {
    if (!wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");

      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    }
  } catch (error) {
    console.warn("Impossible d'empêcher la mise en veille :", error);
  }
}

async function restoreWakeLock() {
  if (document.visibilityState === "visible") {
    await requestWakeLock();
  }
}

videoPlayer.addEventListener("ended", playNextVideo);

videoPlayer.addEventListener("error", () => {
  console.error("Erreur de lecture de :", videoPlayer.src);

  setTimeout(() => {
    playNextVideo();
  }, 2000);
});

document.addEventListener("visibilitychange", async () => {
  await restoreWakeLock();

  if (document.visibilityState === "visible" && videoPlayer.paused) {
    videoPlayer.play().catch(() => {});
  }
});

async function startAutomatically() {
  showStatus("Chargement des vidéos...");

  await loadVideoList();

  if (videos.length === 0) {
    return;
  }

  await playVideo(0);
  await requestFullscreen();
  await requestWakeLock();
}

startAutomatically();