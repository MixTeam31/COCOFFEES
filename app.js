"use strict";

const videoPlayer = document.getElementById("videoPlayer");
const overlay = document.getElementById("overlay");
const statusMessage = document.getElementById("statusMessage");
const startButton = document.getElementById("startButton");

const VIDEO_MANIFEST_URL = "./videos.json";
const LOADING_TEXT = "COCOFFEES - Chargement...";

let videos = [];
let currentVideoIndex = 0;
let wakeLock = null;
let isChangingVideo = false;
let manualStartRequired = false;

/**
 * Affiche le message central.
 */
function showStatus(message = LOADING_TEXT) {
  statusMessage.textContent = message;
  statusMessage.style.display = "block";
  overlay.classList.add("visible");
}

/**
 * Cache le message central.
 */
function hideStatus() {
  statusMessage.style.display = "none";

  if (startButton.style.display === "none") {
    overlay.classList.remove("visible");
  }
}

/**
 * Affiche le bouton uniquement si le navigateur bloque l'autoplay.
 */
function showStartButton() {
  startButton.style.display = "block";
  overlay.classList.add("visible");
}

/**
 * Cache le bouton de démarrage.
 */
function hideStartButton() {
  startButton.style.display = "none";

  if (statusMessage.style.display === "none") {
    overlay.classList.remove("visible");
  }
}

/**
 * Charge la liste des vidéos définie dans videos.json.
 */
async function loadVideoManifest() {
  const response = await fetch(VIDEO_MANIFEST_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Impossible de charger videos.json (HTTP ${response.status}).`
    );
  }

  const manifest = await response.json();

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("videos.json est vide ou son format est invalide.");
  }

  const validVideos = manifest.filter((videoPath) => {
    return typeof videoPath === "string" && videoPath.trim() !== "";
  });

  if (validVideos.length === 0) {
    throw new Error("Aucun chemin vidéo valide dans videos.json.");
  }

  return validVideos;
}

/**
 * Attend qu'une vidéo soit suffisamment prête pour démarrer.
 */
function waitForVideoReady() {
  return new Promise((resolve, reject) => {
    const timeoutDuration = 15000;

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Le chargement de la vidéo a expiré."));
    }, timeoutDuration);

    function cleanup() {
      clearTimeout(timeout);
      videoPlayer.removeEventListener("canplay", onCanPlay);
      videoPlayer.removeEventListener("error", onError);
    }

    function onCanPlay() {
      cleanup();
      resolve();
    }

    function onError() {
      cleanup();
      reject(new Error("La vidéo ne peut pas être lue."));
    }

    videoPlayer.addEventListener("canplay", onCanPlay, { once: true });
    videoPlayer.addEventListener("error", onError, { once: true });
  });
}

/**
 * Charge et lance la vidéo correspondant à l'index reçu.
 */
async function playVideo(index, initiatedByUser = false) {
  if (videos.length === 0 || isChangingVideo) {
    return false;
  }

  isChangingVideo = true;
  currentVideoIndex = index;

  showStatus(LOADING_TEXT);

  try {
    videoPlayer.pause();
    videoPlayer.src = videos[currentVideoIndex];
    videoPlayer.load();

    await waitForVideoReady();
    await videoPlayer.play();

    manualStartRequired = false;

    hideStatus();
    hideStartButton();

    await requestWakeLock();

    return true;
  } catch (error) {
    console.warn(
      `Impossible de lire la vidéo : ${videos[currentVideoIndex]}`,
      error
    );

    if (initiatedByUser) {
      showStatus("COCOFFEES - Impossible de lancer cette vidéo.");
      showStartButton();
    } else {
      manualStartRequired = true;
      showStatus("COCOFFEES - Lecture automatique bloquée.");
      showStartButton();
    }

    return false;
  } finally {
    isChangingVideo = false;
  }
}

/**
 * Passe à la vidéo suivante.
 * Après la dernière vidéo, retour automatique à la première.
 */
async function playNextVideo() {
  if (videos.length === 0) {
    return;
  }

  const nextIndex = (currentVideoIndex + 1) % videos.length;
  const started = await playVideo(nextIndex, false);

  /*
   * Si une vidéo est défectueuse mais que l'autoplay n'est pas le problème,
   * on tente automatiquement la suivante.
   */
  if (!started && !manualStartRequired && videos.length > 1) {
    await playNextVideo();
  }
}

/**
 * Demande le plein écran.
 * Sans geste utilisateur, certains navigateurs le refusent volontairement.
 */
async function requestFullscreen() {
  if (document.fullscreenElement) {
    return true;
  }

  const element = document.documentElement;

  try {
    if (element.requestFullscreen) {
      await element.requestFullscreen({
        navigationUI: "hide"
      });

      return true;
    }

    if (element.webkitRequestFullscreen) {
      element.webkitRequestFullscreen();

      return true;
    }
  } catch (error) {
    console.info("Plein écran automatique non autorisé par le navigateur.");
  }

  return false;
}

/**
 * Active le Wake Lock lorsque le navigateur le supporte.
 * Cela limite la mise en veille de l'écran, sans pouvoir remplacer
 * les réglages système de la TV, tablette ou du PC.
 */
async function requestWakeLock() {
  if (!("wakeLock" in navigator)) {
    return;
  }

  if (wakeLock !== null) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch (error) {
    console.info("Wake Lock non disponible ou refusé sur cet appareil.");
  }
}

/**
 * Démarrage depuis le bouton :
 * l'action utilisateur débloque normalement la lecture et le plein écran.
 */
async function startFromUserAction() {
  hideStartButton();
  showStatus(LOADING_TEXT);

  await requestFullscreen();

  const started = await playVideo(currentVideoIndex, true);

  if (started) {
    await requestWakeLock();
  }
}

/**
 * Si la vidéo se termine : lecture de la suivante.
 */
videoPlayer.addEventListener("ended", async () => {
  await playNextVideo();
});

/**
 * Gestion d'une erreur qui intervient pendant la lecture.
 */
videoPlayer.addEventListener("error", async () => {
  if (isChangingVideo || videos.length === 0) {
    return;
  }

  console.warn("Erreur de lecture détectée. Passage à la vidéo suivante.");

  if (videos.length > 1) {
    await playNextVideo();
  } else {
    showStatus("COCOFFEES - Impossible de lire la vidéo.");
    showStartButton();
  }
});

/**
 * Réactive Wake Lock et tente de reprendre la lecture
 * lorsque l'utilisateur revient sur l'onglet ou l'application.
 */
document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") {
    return;
  }

  await requestWakeLock();

  if (!videoPlayer.src || !videoPlayer.paused || manualStartRequired) {
    return;
  }

  try {
    await videoPlayer.play();
    hideStatus();
    hideStartButton();
  } catch (error) {
    showStatus("COCOFFEES - Lecture en attente.");
    showStartButton();
  }
});

/**
 * Clic du bouton de secours.
 */
startButton.addEventListener("click", startFromUserAction);

/**
 * Initialisation de l'application.
 */
async function initialize() {
  showStatus(LOADING_TEXT);
  hideStartButton();

  try {
    videos = await loadVideoManifest();
    await playVideo(0, false);

    /*
     * Tentative de plein écran automatique.
     * Elle peut être refusée sans clic selon l'appareil/navigateur.
     */
    await requestFullscreen();
    await requestWakeLock();
  } catch (error) {
    console.error(error);
    showStatus("COCOFFEES - Impossible de charger les vidéos.");
    showStartButton();
  }
}

initialize();