const video = document.getElementById("video-player");
const message = document.getElementById("message");
const startButton = document.getElementById("start-button");

let videos = [];
let currentIndex = 0;
let wakeLock = null;
let wakeLockInterval = null;

const videoFolder = "VIDEO/";

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: "base"
  });
}

async function loadVideoList() {
  /*
   * Un navigateur ne peut pas lister automatiquement les fichiers
   * présents dans un dossier GitHub/Vercel.
   *
   * Cette liste est donc générée automatiquement entre 1.mp4 et 999.mp4.
   */
  const foundVideos = [];

  for (let number = 1; number <= 999; number++) {
    const fileName = `${number}.mp4`;
    const url = `${videoFolder}${fileName}`;

    try {
      const response = await fetch(url, {
        method: "HEAD",
        cache: "no-store"
      });

      if (response.ok) {
        foundVideos.push({
          number,
          fileName,
          url
        });
      }
    } catch (error) {
      console.warn(`Impossible de vérifier ${fileName}`, error);
    }
  }

  videos = foundVideos.sort((a, b) => a.number - b.number);
}

function showMessage(text) {
  message.textContent = text;
  message.style.display = "block";
}

function hideMessage() {
  message.style.display = "none";
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.warn("Wake Lock non disponible sur ce navigateur.");
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      console.log("Wake Lock libéré.");
    });

    console.log("Wake Lock activé.");
  } catch (error) {
    console.warn("Impossible d'activer le Wake Lock :", error);
  }
}

async function restoreWakeLock() {
  if (document.visibilityState === "visible") {
    await requestWakeLock();
  }
}

async function enterFullscreen() {
  const container = document.documentElement;

  try {
    if (!document.fullscreenElement && container.requestFullscreen) {
      await container.requestFullscreen();
    }
  } catch (error) {
    console.warn("Plein écran non disponible :", error);
  }
}

async function startPlayback() {
  await enterFullscreen();
  await requestWakeLock();

  startButton.style.display = "none";

  try {
    await video.play();
  } catch (error) {
    console.warn("Lecture automatique bloquée :", error);
    startButton.style.display = "block";
    showMessage("Cliquez sur le bouton pour démarrer la lecture.");
  }
}

function playCurrentVideo() {
  if (videos.length === 0) {
    showMessage("Aucune vidéo trouvée dans le dossier VIDEO.");
    return;
  }

  const currentVideo = videos[currentIndex];

  video.src = currentVideo.url;
  video.load();

  video.play().catch((error) => {
    console.warn("Lecture bloquée :", error);
    startButton.style.display = "block";
    showMessage("Cliquez sur le bouton pour démarrer la lecture.");
  });

  hideMessage();
}

video.addEventListener("ended", () => {
  currentIndex++;

  if (currentIndex >= videos.length) {
    currentIndex = 0;
  }

  playCurrentVideo();
});

video.addEventListener("error", () => {
  console.warn("Erreur de lecture vidéo.");

  currentIndex++;

  if (currentIndex >= videos.length) {
    currentIndex = 0;
  }

  setTimeout(playCurrentVideo, 1000);
});

document.addEventListener("visibilitychange", async () => {
  await restoreWakeLock();

  if (document.visibilityState === "visible" && video.paused) {
    video.play().catch(() => {});
  }
});

startButton.addEventListener("click", startPlayback);

async function initialize() {
  showMessage("Recherche des vidéos...");

  await loadVideoList();

  if (videos.length > 0) {
    currentIndex = 0;
    playCurrentVideo();
  } else {
    showMessage(
      "Aucune vidéo détectée. Vérifiez que les fichiers sont dans VIDEO et nommés 1.mp4, 2.mp4, etc."
    );
  }
}

initialize();

// Nouvelle tentative périodique d'activation du Wake Lock
wakeLockInterval = setInterval(() => {
  if (!wakeLock && document.visibilityState === "visible") {
    requestWakeLock();
  }
}, 30000);
