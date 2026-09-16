"use strict";

const loginPanel = document.getElementById("loginPanel");
const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

const dashboard = document.getElementById("dashboard");
const devicesGrid = document.getElementById("devicesGrid");
const dashboardMessage = document.getElementById("dashboardMessage");
const refreshInfo = document.getElementById("refreshInfo");

const refreshButton = document.getElementById("refreshButton");
const logoutButton = document.getElementById("logoutButton");

const broadcastForm = document.getElementById("broadcastForm");
const broadcastMessage = document.getElementById("broadcastMessage");
const broadcastDuration = document.getElementById("broadcastDuration");
const broadcastUnit = document.getElementById("broadcastUnit");

let videos = [];
let devices = [];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDurationInSeconds(value, unit) {
  const duration = Math.max(1, Number(value) || 1);

  if (unit === "hours") {
    return duration * 3600;
  }

  if (unit === "minutes") {
    return duration * 60;
  }

  return duration;
}

function formatLastSeen(timestamp) {
  const seconds = Math.max(
    0,
    Math.floor(Date.now() / 1000) - Number(timestamp)
  );

  if (seconds < 10) {
    return "à l'instant";
  }

  if (seconds < 60) {
    return `il y a ${seconds} sec.`;
  }

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) {
    return `il y a ${minutes} min.`;
  }

  const hours = Math.floor(minutes / 60);

  return `il y a ${hours} h`;
}

function stateLabel(state) {
  const labels = {
    playing: "▶ Lecture",
    paused: "⏸ Pause",
    waiting_schedule: "◷ Hors horaire",
    unknown: "Inconnu"
  };

  return labels[state] || state;
}

function showDashboardMessage(message, isError = false) {
  dashboardMessage.textContent = message;
  dashboardMessage.style.color = isError ? "#ee7c76" : "#68c48d";

  setTimeout(() => {
    dashboardMessage.textContent = "";
  }, 4500);
}

async function fetchVideos() {
  const response = await fetch("/videos.json", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Impossible de charger videos.json.");
  }

  videos = await response.json();
}

async function checkSession() {
  const response = await fetch("/api/auth/session", {
    cache: "no-store"
  });

  const data = await response.json();

  return Boolean(data.authenticated);
}

async function loadDevices() {
  const response = await fetch("/api/admin/devices", {
    cache: "no-store"
  });

  if (response.status === 401) {
    showLogin();
    return;
  }

  if (!response.ok) {
    throw new Error("Impossible de charger les afficheurs.");
  }

  const data = await response.json();

  devices = data.devices || [];
  renderDevices();

  refreshInfo.textContent = `Mis à jour à ${new Date().toLocaleTimeString("fr-FR")}`;
}

function renderDevices() {
  if (devices.length === 0) {
    devicesGrid.innerHTML = `
      <div class="empty-state">
        Aucun afficheur détecté pour le moment.<br>
        Ouvrez le lien COCOFFEES sur une TV, tablette ou un PC.
      </div>
    `;

    return;
  }

  devicesGrid.innerHTML = devices.map((device) => {
    const currentVideo = device.currentVideo || "Aucune vidéo";
    const videoOptions = videos.map((video, index) => {
      const selected = index === device.currentIndex ? "selected" : "";

      return `
        <option value="${index}" ${selected}>
          ${escapeHtml(video.replace("VIDEO/", ""))}
        </option>
      `;
    }).join("");

    return `
      <article class="device-card ${device.online ? "" : "offline"}">
        <div class="device-header">
          <div>
            <h2 class="device-name">${escapeHtml(device.name)}</h2>
            <p class="device-id">${escapeHtml(device.id)}</p>
          </div>

          <span class="badge ${device.online ? "online" : "offline"}">
            ${device.online ? "EN LIGNE" : "HORS LIGNE"}
          </span>
        </div>

        <div class="device-details">
          <div class="detail-row">
            <span>État</span>
            <strong>${escapeHtml(stateLabel(device.state))}</strong>
          </div>

          <div class="detail-row">
            <span>Vidéo</span>
            <strong>${escapeHtml(currentVideo.replace("VIDEO/", ""))}</strong>
          </div>

          <div class="detail-row">
            <span>Dernière activité</span>
            <strong>${escapeHtml(formatLastSeen(device.lastSeen))}</strong>
          </div>
        </div>

        <div class="controls">
          <button data-command="play" data-device-id="${escapeHtml(device.id)}">
            ▶ Play
          </button>

          <button data-command="pause" data-device-id="${escapeHtml(device.id)}">
            ⏸ Pause
          </button>

          <button data-command="restart" data-device-id="${escapeHtml(device.id)}">
            ↻ Relancer
          </button>
        </div>

        <div class="video-control">
          <select
            class="video-select"
            data-video-select="${escapeHtml(device.id)}"
          >
            ${videoOptions}
          </select>

          <button
            data-change-video="${escapeHtml(device.id)}"
          >
            Lancer
          </button>
        </div>

        <div class="device-notification">
          <input
            type="text"
            maxlength="350"
            placeholder="Message pour cet afficheur"
            data-notification-message="${escapeHtml(device.id)}"
          >

          <input
            type="number"
            min="1"
            max="24"
            value="10"
            data-notification-duration="${escapeHtml(device.id)}"
          >

          <select data-notification-unit="${escapeHtml(device.id)}">
            <option value="seconds">secondes</option>
            <option value="minutes">minutes</option>
            <option value="hours">heures</option>
          </select>

          <button data-send-notification="${escapeHtml(device.id)}">
            Envoyer le pop-up
          </button>
        </div>
      </article>
    `;
  }).join("");
}

async function sendCommand(deviceId, type, payload = {}) {
  const response = await fetch("/api/admin/command", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      deviceId,
      type,
      payload
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Impossible d'envoyer la commande.");
  }

  return data;
}

async function handleDeviceClick(event) {
  const button = event.target.closest("button");

  if (!button) {
    return;
  }

  try {
    const command = button.dataset.command;
    const deviceId = button.dataset.deviceId;

    if (command && deviceId) {
      await sendCommand(deviceId, command);
      showDashboardMessage("Commande envoyée.");
      await loadDevices();
      return;
    }

    const videoDeviceId = button.dataset.changeVideo;

    if (videoDeviceId) {
      const select = document.querySelector(
        `[data-video-select="${CSS.escape(videoDeviceId)}"]`
      );

      const index = Number(select.value);

      await sendCommand(videoDeviceId, "change_video", {
        index
      });

      showDashboardMessage("Changement de vidéo envoyé.");
      return;
    }

    const notificationDeviceId = button.dataset.sendNotification;

    if (notificationDeviceId) {
      const messageInput = document.querySelector(
        `[data-notification-message="${CSS.escape(notificationDeviceId)}"]`
      );

      const durationInput = document.querySelector(
        `[data-notification-duration="${CSS.escape(notificationDeviceId)}"]`
      );

      const unitSelect = document.querySelector(
        `[data-notification-unit="${CSS.escape(notificationDeviceId)}"]`
      );

      const message = messageInput.value.trim();

      if (!message) {
        showDashboardMessage("Saisissez un message.", true);
        return;
      }

      const durationSeconds = getDurationInSeconds(
        durationInput.value,
        unitSelect.value
      );

      await sendCommand(notificationDeviceId, "notification", {
        message,
        durationSeconds
      });

      messageInput.value = "";

      showDashboardMessage("Notification envoyée.");
    }
  } catch (error) {
    showDashboardMessage(error.message, true);
  }
}

async function showLogin() {
  dashboard.classList.add("hidden");
  loginPanel.classList.remove("hidden");
}

async function showDashboard() {
  loginPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");

  await fetchVideos();
  await loadDevices();
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  loginError.textContent = "";

  const formData = new FormData(loginForm);

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: formData.get("id"),
        password: formData.get("password")
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Connexion impossible.");
    }

    loginForm.reset();
    await showDashboard();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", {
    method: "POST"
  });

  showLogin();
});

refreshButton.addEventListener("click", async () => {
  try {
    await loadDevices();
  } catch (error) {
    showDashboardMessage(error.message, true);
  }
});

devicesGrid.addEventListener("click", handleDeviceClick);

broadcastForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = broadcastMessage.value.trim();

  if (!message) {
    return;
  }

  try {
    const durationSeconds = getDurationInSeconds(
      broadcastDuration.value,
      broadcastUnit.value
    );

    await sendCommand("*", "notification", {
      message,
      durationSeconds
    });

    broadcastMessage.value = "";

    showDashboardMessage(
      "Notification envoyée à tous les afficheurs."
    );
  } catch (error) {
    showDashboardMessage(error.message, true);
  }
});

async function initialize() {
  try {
    const authenticated = await checkSession();

    if (authenticated) {
      await showDashboard();
    } else {
      showLogin();
    }
  } catch (error) {
    showLogin();
  }

  setInterval(async () => {
    if (!dashboard.classList.contains("hidden")) {
      try {
        await loadDevices();
      } catch (error) {
        console.warn(error);
      }
    }
  }, 10000);
}

initialize();