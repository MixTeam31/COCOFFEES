const videoPlayer = document.getElementById("videoPlayer");
const statusMessage = document.getElementById("status");

let videos = [];
let currentIndex = 0;
let wakeLock = null;
let playbackStarted = false;

function showStatus(message) {
  statusMessage.textContent = message;
  statusMessage.style.display = "block";
}

function hideStatus() {
  statusMessage.style.display = "none";
}

function showPlayButton() {
  let playButton = document.getElementById("playButton");

  if (!playButton) {
    playButton = document.createElement("button");
    playButton.id = "playButton";
    playButton.textContent = "▶ Lancer la lecture";

    playButton.addEventListener("click", async () => {
      await startPlayback();
    });

    document.body.appendChild(playButton);
  }

  playButton.style.display = "block";
}

function hidePlayButton() {
  const playButton = document.getElementById("playButton");

  if (playButton) {
    playButton.style.display = "none";
  }
}

async function loadVideos() {
  try {
    const response = await fetch("./videos.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const videoList = await response.json();

    if (!Array.isArray(videoList) || videoList.length === 0) {
      throw new Error("La liste des vidéos est vide.");
    }

    videos = videoList;
  } catch (error) {
    console.error("Erreur de chargement :", error);
    showStatus("Impossible de charger videos.json.");
  }
}

async function loadAndPlayVideo(index) {
  if (videos.length === 0) {
    return false;
  }

  currentIndex = index;
  videoPlayer.src = videos[currentIndex];
  videoPlayer.load();

  try {
    await videoPlayer.play();

    playbackStarted = true;
    hideStatus();
    hidePlayButton();

    return true;
  } catch (error) {
    console.warn("Lecture automatique refusée :", error);

    playbackStarted = false;
    showStatus("La lecture automatique est bloquée.");
    showPlayButton();

    return false;
  }
}

async function playNextVideo() {
  if (videos.length === 0) {
    return;
  }

  currentIndex = (currentIndex + 1) % videos.length;

  await loadAndPlayVideo(currentIndex);
}

async function requestFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({
        navigationUI: "hide"
      });
    }
  } catch (error) {
    console.warn("Plein écran automatique refusé :", error);
  }
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.warn("Wake Lock non disponible sur cet appareil.");
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

async function startPlayback() {
  hideStatus();

  // Le clic utilisateur permet généralement de débloquer la lecture
  const started = await loadAndPlayVideo(currentIndex);

  if (started) {
    await requestFullscreen();
    await requestWakeLock();
  }
}

videoPlayer.addEventListener("ended", async () => {
  await playNextVideo();
});

videoPlayer.addEventListener("error", () => {
  console.error("Erreur avec la vidéo :", videoPlayer.src);

  setTimeout(async () => {
    await playNextVideo();
  }, 2000);
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState === "visible") {
    await requestWakeLock();

    if (playbackStarted && videoPlayer.paused) {
      try {
        await videoPlayer.play();
      } catch (error) {
        showStatus("Cliquez sur le bouton pour reprendre la lecture.");
        showPlayButton();
      }
    }
  }
});

async function initialize() {
  showStatus("Chargement des vidéos...");

  await loadVideos();

  if (videos.length === 0) {
    return;
  }

  /*
   * Première tentative automatique.
   * La vidéo est muette dans index.html, donc l'autoplay
   * est normalement accepté par les navigateurs.
   */
  const startedAutomatically = await loadAndPlayVideo(0);

  if (startedAutomatically) {
    await requestFullscreen();
    await requestWakeLock();
  }
}

initialize();