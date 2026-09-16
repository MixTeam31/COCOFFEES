"use strict";

const videoPlayer = document.getElementById("videoPlayer");
const overlay = document.getElementById("overlay");
const statusMessage = document.getElementById("statusMessage");
const startButton = document.getElementById("startButton");

const startupScreen = document.getElementById("startupScreen");
const startupText = document.getElementById("startupText");
const startupProgressBar = document.getElementById("startupProgressBar");

const closingNotice = document.getElementById("closingNotice");
const closingNoticeText = document.getElementById("closingNoticeText");

const remoteNotification = document.getElementById("remoteNotification");
const remoteNotificationText = document.getElementById("remoteNotificationText");

const VIDEO_MANIFEST_URL = "./videos.json";
const SCHEDULE_URL = "./schedule.json";

const HEARTBEAT_INTERVAL_MS = 10000;
const COMMAND_POLL_INTERVAL_MS = 3000;
const SCHEDULE_CHECK_INTERVAL_MS = 10000;

const LOADING_TEXT = "COCOFFEES - Chargement...";

let videos = [];
let schedule = null;
let currentVideoIndex = 0;
let wakeLock = null;

let isChangingVideo = false;
let manualStartRequired = false;
let manualPaused = false;
let displayIsOpen = true;
let notificationTimeout = null;
let commandPollInProgress = false;

const deviceId = getOrCreateDeviceId();
const deviceName = getDeviceName();

/* -------------------------------------------------------------------------- */
/* Identité de l'afficheur                                                    */
/* -------------------------------------------------------------------------- */

function getOrCreateDeviceId() {
  const storageKey = "cocoffees_device_id";
  let id = localStorage.getItem(storageKey);

  if (!id) {
    id = `display-${crypto.randomUUID()}`;
    localStorage.setItem(storageKey, id);
  }

  return id;
}

function getDeviceName() {
  const queryName = new URLSearchParams(window.location.search).get("name");

  if (queryName && queryName.trim()) {
    localStorage.setItem("cocoffees_device_name", queryName.trim());
  }

  let name = localStorage.getItem("cocoffees_device_name");

  if (!name) {
    const shortId = deviceId.slice(-6).toUpperCase();
    name = `Afficheur ${shortId}`;
    localStorage.setItem("cocoffees_device_name", name);
  }

  return name;
}

/* -------------------------------------------------------------------------- */
/* Interface                                                                  */
/* -------------------------------------------------------------------------- */

function showStatus(message = LOADING_TEXT) {
  statusMessage.textContent = message;
  statusMessage.style.display = "block";
  overlay.classList.add("visible");
}

function hideStatus() {
  statusMessage.style.display = "none";

  if (startButton.style.display === "none") {
    overlay.classList.remove("visible");
  }
}

function showStartButton() {
  startButton.style.display = "block";
  overlay.classList.add("visible");
}

function hideStartButton() {
  startButton.style.display = "none";

  if (statusMessage.style.display === "none") {
    overlay.classList.remove("visible");
  }
}

function setStartupStep(text, progress) {
  startupText.textContent = text;
  startupProgressBar.style.width = `${progress}%`;
}

function hideStartup() {
  startupScreen.classList.add("hidden");
}

function showClosingNotice(message) {
  closingNoticeText.textContent = message;
  closingNotice.classList.add("visible");
}

function hideClosingNotice() {
  closingNotice.classList.remove("visible");
}

function showRemoteNotification(message, durationSeconds) {
  if (notificationTimeout) {
    clearTimeout(notificationTimeout);
  }

  remoteNotificationText.textContent = message;
  remoteNotification.classList.add("visible");

  const safeDuration = Math.max(1, Number(durationSeconds) || 10);

  notificationTimeout = setTimeout(() => {
    remoteNotification.classList.remove("visible");
  }, safeDuration * 1000);
}

/* -------------------------------------------------------------------------- */
/* Vidéos                                                                     */
/* -------------------------------------------------------------------------- */

async function loadVideoManifest() {
  const response = await fetch(VIDEO_MANIFEST_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Impossible de charger videos.json : ${response.status}`);
  }

  const manifest = await response.json();

  if (!Array.isArray(manifest) || manifest.length === 0) {
    throw new Error("videos.json est vide ou incorrect.");
  }

  const validVideos = manifest.filter((videoPath) => {
    return typeof videoPath === "string" && videoPath.trim() !== "";
  });

  if (validVideos.length === 0) {
    throw new Error("Aucune vidéo valide n'est configurée.");
  }

  return validVideos;
}

function waitForVideoReady() {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Expiration du chargement vidéo."));
    }, 20000);

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
      reject(new Error("Vidéo non lisible."));
    }

    videoPlayer.addEventListener("canplay", onCanPlay, { once: true });
    videoPlayer.addEventListener("error", onError, { once: true });
  });
}

async function playVideo(index, initiatedByUser = false) {
  if (
    videos.length === 0 ||
    isChangingVideo ||
    !displayIsOpen
  ) {
    return false;
  }

  isChangingVideo = true;
  currentVideoIndex = Math.max(0, Math.min(index, videos.length - 1));

  showStatus(LOADING_TEXT);

  try {
    videoPlayer.pause();
    videoPlayer.src = videos[currentVideoIndex];
    videoPlayer.load();

    await waitForVideoReady();
    await videoPlayer.play();

    manualStartRequired = false;
    manualPaused = false;

    hideStatus();
    hideStartButton();

    await requestWakeLock();
    sendHeartbeat();

    return true;
  } catch (error) {
    console.warn("Erreur de lecture vidéo :", error);

    if (initiatedByUser) {
      showStatus("COCOFFEES - Impossible de lancer cette vidéo.");
    } else {
      manualStartRequired = true;
      showStatus("COCOFFEES - Lecture automatique bloquée.");
    }

    showStartButton();

    return false;
  } finally {
    isChangingVideo = false;
  }
}

async function playNextVideo() {
  if (videos.length === 0 || !displayIsOpen || manualPaused) {
    return;
  }

  const nextIndex = (currentVideoIndex + 1) % videos.length;
  await playVideo(nextIndex);
}

/* -------------------------------------------------------------------------- */
/* Wake Lock et plein écran                                                   */
/* -------------------------------------------------------------------------- */

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock !== null) {
    return;
  }

  try {
    wakeLock = await navigator.wakeLock.request("screen");

    wakeLock.addEventListener("release", () => {
      wakeLock = null;
    });
  } catch (error) {
    console.info("Wake Lock non disponible.");
  }
}

async function requestFullscreen() {
  if (document.fullscreenElement) {
    return true;
  }

  try {
    await document.documentElement.requestFullscreen({
      navigationUI: "hide"
    });

    return true;
  } catch (error) {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Horaires                                                                   */
/* -------------------------------------------------------------------------- */

async function loadSchedule() {
  const response = await fetch(SCHEDULE_URL, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Impossible de charger schedule.json.");
  }

  return response.json();
}

function getParisTimeParts() {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: schedule?.timezone || "Europe/Paris",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(new Date());

  const value = (type) => {
    return parts.find((part) => part.type === type)?.value;
  };

  return {
    weekday: value("weekday").toLowerCase(),
    hour: Number(value("hour")),
    minute: Number(value("minute"))
  };
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatDuration(totalMinutes) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const days = Math.floor(safeMinutes / 1440);
  const hours = Math.floor((safeMinutes % 1440) / 60);
  const minutes = safeMinutes % 60;

  if (days > 0) {
    return `${days} j ${hours} h ${minutes} min`;
  }

  if (hours > 0) {
    return `${hours} h ${minutes.toString().padStart(2, "0")} min`;
  }

  return `${minutes} min`;
}

function getNextOpening(currentDay, currentMinutes) {
  const orderedDays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday"
  ];

  const currentDayIndex = orderedDays.indexOf(currentDay);

  for (let offset = 0; offset < 8; offset += 1) {
    const dayIndex = (currentDayIndex + offset) % 7;
    const dayName = orderedDays[dayIndex];
    const daySchedule = schedule.openingHours[dayName];

    if (!daySchedule) {
      continue;
    }

    const openMinutes = timeToMinutes(daySchedule.open);

    if (offset === 0 && currentMinutes >= openMinutes) {
      continue;
    }

    const minutesUntil = (offset * 1440) + openMinutes - currentMinutes;

    return {
      dayName,
      open: daySchedule.open,
      minutesUntil
    };
  }

  return null;
}

async function applySchedule() {
  if (!schedule) {
    return;
  }

  const now = getParisTimeParts();
  const currentMinutes = now.hour * 60 + now.minute;
  const todaySchedule = schedule.openingHours[now.weekday];

  if (!todaySchedule) {
    displayIsOpen = false;
    videoPlayer.pause();

    const nextOpening = getNextOpening(now.weekday, currentMinutes);

    showStatus(
      nextOpening
        ? `COCOFFEES\nConnecté\nEn attente de l'horaire\nLancement dans ${formatDuration(nextOpening.minutesUntil)}`
        : "COCOFFEES\nConnecté\nEn attente de l'horaire"
    );

    hideClosingNotice();
    sendHeartbeat();
    return;
  }

  const openMinutes = timeToMinutes(todaySchedule.open);
  const closeMinutes = timeToMinutes(todaySchedule.close);

  if (currentMinutes < openMinutes) {
    displayIsOpen = false;
    videoPlayer.pause();

    showStatus(
      `COCOFFEES\nConnecté\nEn attente de l'ouverture\nLancement dans ${formatDuration(openMinutes - currentMinutes)}`
    );

    hideClosingNotice();
    sendHeartbeat();
    return;
  }

  if (currentMinutes >= closeMinutes) {
    displayIsOpen = false;
    videoPlayer.pause();

    const nextOpening = getNextOpening(now.weekday, currentMinutes);

    showStatus(
      nextOpening
        ? `COCOFFEES\nConnecté\nEn attente de l'horaire\nProchaine ouverture dans ${formatDuration(nextOpening.minutesUntil)}`
        : "COCOFFEES\nConnecté\nEn attente de l'horaire"
    );

    hideClosingNotice();
    sendHeartbeat();
    return;
  }

  const wasClosed = !displayIsOpen;
  displayIsOpen = true;

  const minutesUntilClosing = closeMinutes - currentMinutes;
  const warningMinutes = Number(schedule.closingWarningMinutes || 15);

  if (minutesUntilClosing <= warningMinutes) {
    showClosingNotice(
      `Fermeture à ${todaySchedule.close} · Dans ${formatDuration(minutesUntilClosing)}`
    );
  } else {
    hideClosingNotice();
  }

  if (wasClosed && !manualPaused) {
    await playVideo(currentVideoIndex);
  }
}

/* -------------------------------------------------------------------------- */
/* Turso via API Vercel                                                       */
/* -------------------------------------------------------------------------- */

function getCurrentState() {
  if (!displayIsOpen) {
    return "waiting_schedule";
  }

  if (videoPlayer.paused || manualPaused) {
    return "paused";
  }

  return "playing";
}

async function sendHeartbeat() {
  try {
    await fetch("/api/devices/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        deviceId,
        deviceName,
        userAgent: navigator.userAgent,
        currentVideo: videos[currentVideoIndex] || "",
        currentIndex: currentVideoIndex,
        state: getCurrentState()
      })
    });
  } catch (error) {
    console.info("Heartbeat temporairement indisponible.");
  }
}

async function acknowledgeCommands(commandIds) {
  if (!commandIds.length) {
    return;
  }

  await fetch("/api/devices/acknowledge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deviceId,
      commandIds
    })
  });
}

async function handleCommand(command) {
  const payload = command.payload || {};

  switch (command.type) {
    case "play":
      manualPaused = false;

      if (displayIsOpen) {
        await videoPlayer.play();
      }

      break;

    case "pause":
      manualPaused = true;
      videoPlayer.pause();
      break;

    case "restart":
      manualPaused = false;
      videoPlayer.currentTime = 0;

      if (displayIsOpen) {
        await videoPlayer.play();
      }

      break;

    case "change_video": {
      const requestedIndex = Number(payload.index);

      if (
        Number.isInteger(requestedIndex) &&
        requestedIndex >= 0 &&
        requestedIndex < videos.length
      ) {
        manualPaused = false;
        await playVideo(requestedIndex, true);
      }

      break;
    }

    case "notification":
      showRemoteNotification(
        String(payload.message || "Message COCOFFEES"),
        Number(payload.durationSeconds || 10)
      );
      break;

    default:
      console.warn("Commande inconnue :", command.type);
  }
}

async function pollCommands() {
  if (commandPollInProgress) {
    return;
  }

  commandPollInProgress = true;

  try {
    const response = await fetch(
      `/api/devices/commands?deviceId=${encodeURIComponent(deviceId)}`,
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const commandIds = [];

    for (const command of data.commands || []) {
      await handleCommand(command);
      commandIds.push(command.id);
    }

    await acknowledgeCommands(commandIds);
    await sendHeartbeat();
  } catch (error) {
    console.info("Lecture des commandes indisponible.");
  } finally {
    commandPollInProgress = false;
  }
}

/* -------------------------------------------------------------------------- */
/* Événements                                                                 */
/* -------------------------------------------------------------------------- */

videoPlayer.addEventListener("ended", playNextVideo);

videoPlayer.addEventListener("error", async () => {
  if (isChangingVideo || videos.length <= 1) {
    return;
  }

  await playNextVideo();
});

videoPlayer.addEventListener("play", sendHeartbeat);
videoPlayer.addEventListener("pause", sendHeartbeat);

startButton.addEventListener("click", async () => {
  hideStartButton();

  await requestFullscreen();
  await requestWakeLock();

  if (displayIsOpen) {
    await playVideo(currentVideoIndex, true);
  }
});

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible") {
    return;
  }

  await requestWakeLock();
  await applySchedule();

  if (
    displayIsOpen &&
    !manualPaused &&
    videoPlayer.paused &&
    !manualStartRequired
  ) {
    try {
      await videoPlayer.play();
    } catch (error) {
      showStartButton();
    }
  }
});

/* -------------------------------------------------------------------------- */
/* Initialisation                                                             */
/* -------------------------------------------------------------------------- */

async function initialize() {
  try {
    setStartupStep("Connexion de l'afficheur...", 20);

    schedule = await loadSchedule();

    setStartupStep("Synchronisation des vidéos...", 52);

    videos = await loadVideoManifest();

    setStartupStep("Vérification des horaires...", 75);

    await applySchedule();

    setStartupStep("COCOFFEES est prêt", 100);

    await sendHeartbeat();

    if (displayIsOpen) {
      await playVideo(0);
      await requestFullscreen();
      await requestWakeLock();
    }

    setTimeout(hideStartup, 850);
  } catch (error) {
    console.error(error);

    setStartupStep("Erreur de connexion", 100);
    showStatus("COCOFFEES - Impossible de charger la configuration.");
    showStartButton();
  }

  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  setInterval(pollCommands, COMMAND_POLL_INTERVAL_MS);
  setInterval(applySchedule, SCHEDULE_CHECK_INTERVAL_MS);
}

initialize();