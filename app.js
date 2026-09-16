const videoPlayer = document.getElementById("videoPlayer");
const fullscreenButton = document.getElementById("fullscreenButton");
const loading = document.getElementById("loading");

let videos = [];
let currentIndex = 0;
let wakeLock = null;

function showMessage(message) {
  loading.textContent = message;
  loading.style.display = "block";
}

function hideMessage() {
  loading.style.display = "none";
}

async function loadVideos() {
  try {
    const response = await fetch("./videos.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Le fichier videos.json est vide ou incorrect.");
    }

    videos = data;
    console.log("Vidéos chargées :", videos);
  } catch (error) {
    console.error(error);
    showMessage(
      "Impossible de charger videos.json. Vérifiez que le fichier existe."
    );
  }
}

async function playCurrentVideo() {
  if (videos.length === 0) {
    showMessage("Aucune vidéo disponible.");
    return;
  }

  const videoUrl = videos[currentIndex];

  videoPlayer.src = videoUrl;
  videoPlayer.load();

  try {
    await videoPlayer.play();
    hideMessage();
  } catch (error) {
    console.error("Lecture automatique bloquée :", error);
    showMessage("Cliquez sur le bouton pour démarrer la lecture.");
    fullscreenButton.style.display = "block";
  }
}

function playNextVideo() {
  currentIndex++;

  if (currentIndex >= videos.length) {
    currentIndex = 0;
  }

  playCurrentVideo();
}

async function enterFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }

    fullscreenButton.style.display = "none";
  } catch (error) {
    console.warn("Le plein écran a été bloqué :", error);
    fullscreenButton.style.display = "block";
  }
}

async function enableWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.warn("Wake Lock non disponible sur cet appareil.");
    return;
  }

  try {
    if (!wakeLock) {
      wakeLock = await navigator.wakeLock.request("screen");

      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        console.warn("Wake Lock désactivé.");
      });

      console.log("Protection contre la mise en veille activée.");
    }
  } catch (error) {
    console.warn("Impossible d'activer la protection contre la veille :", error);
  }
}

async function startPlayer() {
  await enterFullscreen();
  await enableWakeLock();

  try {
    await videoPlayer.play();
    hideMessage();
  } catch (error) {
    console.error(error);
    fullscreenButton.style.display = "block";
  }
}

videoPlayer.addEventListener("ended", playNextVideo);

videoPlayer.addEventListener("error", () => {
  console.error("Erreur de lecture :", videoPlayer.src);
  showMessage(`Erreur de lecture : ${videoPlayer.src}`);

  setTimeout(() => {
    playNextVideo();
  }, 2000);
});

fullscreenButton.addEventListener("click", startPlayer);

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await enableWakeLock();

    if (videoPlayer.paused) {
      videoPlayer.play().catch(() => {
        fullscreenButton.style.display = "block";
      });
    }
  }
});

async function initialize() {
  showMessage("Chargement des vidéos...");

  await loadVideos();

  if (videos.length > 0) {
    await playCurrentVideo();
    await enterFullscreen();
    await enableWakeLock();
  }
}

initialize();