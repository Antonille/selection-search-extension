const OVERRIDE_KEY = "configOverrideDocument";
const DEFAULTS_PATH = "providers.default.json";

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  const params = new URLSearchParams(window.location.search);
  const resourceId = params.get("resourceId") || "";
  const target = params.get("target") || "";

  const config = await loadActiveConfig();
  const resources = extractResources(config);
  const resource = resources.find((item) => item.id === resourceId);

  document.getElementById("resourceTitle").textContent = resource?.title || resourceId || "Selection Search target";
  document.getElementById("resultFormat").textContent = resource?.resultHandling?.resultFormat || "unknown";
  document.getElementById("displayHint").textContent = resource?.resultHandling?.displayHint || "";
  document.getElementById("targetUrl").textContent = target || "(missing URL)";

  const notesHost = document.getElementById("notes");
  const notes = resource?.resultHandling?.notesForUser ?? [];
  if (notes.length) {
    const ul = document.createElement("ul");
    for (const note of notes) {
      const li = document.createElement("li");
      li.textContent = note;
      ul.appendChild(li);
    }
    notesHost.appendChild(ul);
  } else {
    notesHost.textContent = "No extra handling notes were provided for this resource.";
  }

  document.getElementById("openHereBtn").addEventListener("click", () => {
    if (target) {
      window.location.href = target;
    }
  });

  document.getElementById("openNewTabBtn").addEventListener("click", async () => {
    if (target) {
      await chrome.tabs.create({ url: target });
    }
  });

  document.getElementById("copyUrlBtn").addEventListener("click", async () => {
    if (!target) {
      return;
    }
    try {
      await navigator.clipboard.writeText(target);
      alert("Copied URL to clipboard.");
    } catch (_error) {
      alert("Could not copy URL automatically.");
    }
  });
}

async function loadActiveConfig() {
  const stored = await chrome.storage.local.get(OVERRIDE_KEY);
  if (stored[OVERRIDE_KEY]) {
    return stored[OVERRIDE_KEY];
  }

  const response = await fetch(chrome.runtime.getURL(DEFAULTS_PATH), { cache: "no-store" });
  return await response.json();
}

function extractResources(config) {
  if (!config || typeof config !== "object") {
    return [];
  }

  if (Array.isArray(config.resources)) {
    return config.resources.map((item) => ({
      id: String(item.id ?? "").trim(),
      title: String(item.menu?.title ?? item.resource?.resource_label ?? item.resource?.site_name ?? item.id ?? "").trim(),
      resultHandling: {
        resultFormat: String(item.result_handling?.result_format ?? "unknown"),
        displayHint: String(item.result_handling?.display_hint ?? ""),
        notesForUser: Array.isArray(item.result_handling?.notes_for_user) ? item.result_handling.notes_for_user.map(String) : []
      }
    }));
  }

  if (Array.isArray(config.finalists)) {
    return config.finalists.map((item) => ({
      id: String(item.id ?? "").trim(),
      title: String(item.label ?? item.site_name ?? item.id ?? "").trim(),
      resultHandling: {
        resultFormat: String(item.result_format ?? "unknown"),
        displayHint: item.result_format === "html" ? "Open directly in a browser tab" : "This resource may return structured data or a non-HTML payload.",
        notesForUser: item.result_format === "html" ? [] : [`Expected format: ${String(item.result_format ?? "unknown").toUpperCase()}`]
      }
    }));
  }

  return [];
}
