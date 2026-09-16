const videoPlayer = document.getElementById("videoPlayer");
const fullscreenButton = document.getElementById("fullscreenButton");
const loading = document.getElementById("loading");

const videoFolder = "VIDEO/";
const maximumNumberOfVideos = 999;

let videoFiles = [];
let currentVideoIndex = 0;
let wakeLock = null;

async function findVideos() {
  const foundVideos = [];

  for (
    let videoNumber = 1;
    videoNumber <= maximumNumberOfVideos;
    videoNumber++
  ) {
    const fileName = `${videoNumber}.mp4`;
    const videoUrl = `${videoFolder}${fileName}`;

    try {
      const response = await fetch(videoUrl, {
        method: "HEAD",
        cache: "no-store"
      });

      if (response.ok) {
        foundVideos.push(videoUrl);
      }
    } catch (error) {
      console.warn(`Erreur lors de la recherche de ${fileName}`, error);
    }
  }

  return foundVideos;
}

function showLoading(message) {
  loading.textContent = message;
  loading.style.display = "block";
}

function hideLoading() {
  loading.style.display = "none";
}

async function activateFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }

    fullscreenButton.style.display = "none";
  } catch (error) {
    console.warn("Le plein écran automatique a été bloqué.", error);
    fullscreenButton.style.display = "block";
  }
}

async function activateWakeLock() {
  if (!("wakeLock" in navigator)) {
    console.warn("La fonction Wake Lock n'est pas disponible.");
    return;
  }

  try {
    if (wakeLock === null) {
      wakeLock = await navigator.wakeLock.request("screen");

      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        console.warn("Wake Lock désactivé.");
      });

      console.log("Wake Lock activé.");
    }
  } catch (error) {
    console.warn("Impossible d'empêcher la mise en veille.", error);
  }
}

async function restoreWakeLock() {
  if (document.visibilityState === "visible") {
    await activateWakeLock();
  }
}

async function playVideo(index) {
  if (videoFiles.length === 0) {
    showLoading("Aucune vidéo trouvée dans le dossier VIDEO.");
    return;
  }

  currentVideoIndex = index;

  videoPlayer.src = videoFiles[currentVideoIndex];
  videoPlayer.load();

  try {
    await videoPlayer.play();
    hideLoading();
  } catch (error) {
    console.warn("La lecture automatique a été bloquée.", error);
    showLoading("Cliquez sur le bouton pour démarrer la lecture.");
    fullscreenButton.style.display = "block";
  }
}

async function startPlayer() {
  fullscreenButton.style.display = "none";
  hideLoading();

  await activateFullscreen();
  await activateWakeLock();

  try {
    await videoPlayer.play();
  } catch (error) {
    console.warn("Impossible de démarrer la vidéo.", error);
    fullscreenButton.style.display = "block";
  }
}

videoPlayer.addEventListener("ended", async () => {
  let nextIndex = currentVideoIndex + 1;

  if (nextIndex >= videoFiles.length) {
    nextIndex = 0;
  }

  await playVideo(nextIndex);
});

videoPlayer.addEventListener("error", async () => {
  console.warn("Erreur avec la vidéo actuelle.");

  let nextIndex = currentVideoIndex + 1;

  if (nextIndex >= videoFiles.length) {
    nextIndex = 0;
  }

  setTimeout(() => {
    playVideo(nextIndex);
  }, 1000);
});

fullscreenButton.addEventListener("click", startPlayer);

document.addEventListener("visibilitychange", async () => {
  await restoreWakeLock();

  if (document.visibilityState === "visible") {
    try {
      await videoPlayer.play();
    } catch (error) {
      console.warn("La reprise automatique a été bloquée.");
    }
  }
});

document.addEventListener("fullscreenchange", () => {
  if (document.fullscreenElement) {
    fullscreenButton.style.display = "none";
  }
});

async function initializePlayer() {
  showLoading("Recherche des vidéos...");

  videoFiles = await findVideos();

  if (videoFiles.length === 0) {
    showLoading(
      "Aucune vidéo trouvée. Vérifiez les fichiers 1.mp4, 2.mp4, etc."
    );
    return;
  }

  console.log("Vidéos détectées :", videoFiles);

  await playVideo(0);

  // Demande automatique du plein écran.
  // Certains navigateurs exigeront un clic utilisateur.
  await activateFullscreen();

  // Activation de la protection contre la mise en veille.
  await activateWakeLock();
}

initializePlayer();
