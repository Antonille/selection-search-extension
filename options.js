const CONFIG_KEY = "configDocument";
const DEFAULTS_PATH = "providers.default.json";

const configBox = document.getElementById("configBox");
const statusBox = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const exportBtn = document.getElementById("exportBtn");
const importFile = document.getElementById("importFile");

initialize().catch((error) => {
  setStatus(`Failed to initialize options page: ${error.message}`, true);
});

saveBtn.addEventListener("click", saveConfig);
resetBtn.addEventListener("click", resetToDefaults);
exportBtn.addEventListener("click", exportConfig);
importFile.addEventListener("change", importConfig);

async function initialize() {
  const config = await getStoredOrDefaultConfig();
  configBox.value = prettyJson(config);
  setStatus("Loaded current config.");
}

async function getStoredOrDefaultConfig() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = stored[CONFIG_KEY];

  if (isSupportedConfig(config)) {
    return config;
  }

  const defaults = await loadDefaults();
  await chrome.storage.local.set({ [CONFIG_KEY]: defaults });
  return defaults;
}

async function loadDefaults() {
  const response = await fetch(chrome.runtime.getURL(DEFAULTS_PATH));
  return await response.json();
}

async function saveConfig() {
  try {
    const parsed = JSON.parse(configBox.value);
    validateConfig(parsed);
    await chrome.storage.local.set({ [CONFIG_KEY]: parsed });
    configBox.value = prettyJson(parsed);
    setStatus("Saved.");
  } catch (error) {
    setStatus(`Save failed: ${error.message}`, true);
  }
}

async function resetToDefaults() {
  try {
    const defaults = await loadDefaults();
    validateConfig(defaults);
    await chrome.storage.local.set({ [CONFIG_KEY]: defaults });
    configBox.value = prettyJson(defaults);
    setStatus("Defaults restored.");
  } catch (error) {
    setStatus(`Reset failed: ${error.message}`, true);
  }
}

async function exportConfig() {
  try {
    const parsed = JSON.parse(configBox.value);
    validateConfig(parsed);

    const blob = new Blob([prettyJson(parsed)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "selection-search-config.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exported JSON.");
  } catch (error) {
    setStatus(`Export failed: ${error.message}`, true);
  }
}

async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    validateConfig(parsed);
    configBox.value = prettyJson(parsed);
    await chrome.storage.local.set({ [CONFIG_KEY]: parsed });
    setStatus(`Imported ${file.name}.`);
  } catch (error) {
    setStatus(`Import failed: ${error.message}`, true);
  } finally {
    event.target.value = "";
  }
}

function isSupportedConfig(value) {
  return Array.isArray(value) || !!(value && typeof value === "object");
}

function validateConfig(input) {
  if (Array.isArray(input)) {
    validateProviderArray(input);
    return;
  }

  if (!input || typeof input !== "object") {
    throw new Error("Top-level JSON must be an object or an array.");
  }

  if (Array.isArray(input.providers)) {
    validateProviderArray(input.providers);
    return;
  }

  if (Array.isArray(input.finalists)) {
    validateFinalists(input.finalists);
    return;
  }

  throw new Error("Object config must contain a 'providers' array or a 'finalists' array.");
}

function validateProviderArray(input) {
  const ids = new Set();

  input.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Entry ${index + 1} must be an object.`);
    }

    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim();
    const urlTemplate = String(item.urlTemplate ?? "").trim();

    if (!id) {
      throw new Error(`Entry ${index + 1} is missing a valid id.`);
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate id found: ${id}`);
    }
    ids.add(id);

    if (!title) {
      throw new Error(`Entry ${id} is missing a title.`);
    }

    if (!urlTemplate || (!urlTemplate.includes("{text}") && !urlTemplate.includes("{raw}"))) {
      throw new Error(`Entry ${id} must include {text} or {raw} in urlTemplate.`);
    }

    const encoding = item.filters?.encoding;
    if (encoding && !["url", "plus", "none"].includes(encoding)) {
      throw new Error(`Entry ${id} has invalid filters.encoding: ${encoding}`);
    }

    if (item.filters?.regexReplacements && !Array.isArray(item.filters.regexReplacements)) {
      throw new Error(`Entry ${id} has invalid regexReplacements; expected an array.`);
    }
  });
}

function validateFinalists(input) {
  const ids = new Set();

  input.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Finalist ${index + 1} must be an object.`);
    }

    const id = String(item.id ?? "").trim();
    const urlTemplate = String(item.url_template ?? "").trim();

    if (!id) {
      throw new Error(`Finalist ${index + 1} is missing a valid id.`);
    }

    if (ids.has(id)) {
      throw new Error(`Duplicate finalist id found: ${id}`);
    }
    ids.add(id);

    if (!urlTemplate) {
      throw new Error(`Finalist ${id} is missing url_template.`);
    }
  });
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "#b00020" : "inherit";
}
