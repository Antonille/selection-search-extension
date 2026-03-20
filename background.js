const CONFIG_KEY = "configDocument";
const DEFAULTS_PATH = "providers.default.json";
const ROOT_MENU_ID = "selection-search-root";
const CATEGORY_PREFIX = "category:";
const GROUP_PREFIX = "group:";
const PROVIDER_PREFIX = "provider:";

let rebuildQueue = Promise.resolve();

chrome.runtime.onInstalled.addListener(async () => {
  await ensureConfigExists();
  await queueContextMenuRebuild();
});

chrome.runtime.onStartup.addListener(async () => {
  await ensureConfigExists();
  await queueContextMenuRebuild();
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === "local" && changes[CONFIG_KEY]) {
    await queueContextMenuRebuild();
  }
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (!info.menuItemId || !String(info.menuItemId).startsWith(PROVIDER_PREFIX)) {
    return;
  }

  const providerId = String(info.menuItemId).slice(PROVIDER_PREFIX.length);
  const providers = await getProviders();
  const provider = providers.find((item) => item.id === providerId);

  if (!provider || !info.selectionText) {
    return;
  }

  const url = buildUrl(provider, info.selectionText);
  if (!url) {
    return;
  }

  await chrome.tabs.create({
    url,
    active: provider.openInBackground ? false : true
  });
});


async function queueContextMenuRebuild() {
  rebuildQueue = rebuildQueue
    .then(() => rebuildContextMenu())
    .catch((error) => {
      console.error("Failed to rebuild context menu:", error);
    });

  return rebuildQueue;
}

async function ensureConfigExists() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const existing = stored[CONFIG_KEY];

  if (isSupportedConfig(existing)) {
    return existing;
  }

  const defaults = await loadDefaultConfig();
  await chrome.storage.local.set({ [CONFIG_KEY]: defaults });
  return defaults;
}

async function getRawConfig() {
  const stored = await chrome.storage.local.get(CONFIG_KEY);
  const config = stored[CONFIG_KEY];

  if (isSupportedConfig(config)) {
    return config;
  }

  return ensureConfigExists();
}

async function getProviders() {
  const config = await getRawConfig();
  return extractProviders(config);
}

async function loadDefaultConfig() {
  const response = await fetch(chrome.runtime.getURL(DEFAULTS_PATH));
  return await response.json();
}

function isSupportedConfig(value) {
  return Array.isArray(value) || !!(value && typeof value === "object");
}

async function rebuildContextMenu() {
  const providers = (await getProviders()).filter((item) => item.enabled !== false);

  await chrome.contextMenus.removeAll();

  if (providers.length === 0) {
    chrome.contextMenus.create({
      id: ROOT_MENU_ID,
      title: "Selection Search (no providers enabled)",
      contexts: ["selection"]
    });
    return;
  }

  chrome.contextMenus.create({
    id: ROOT_MENU_ID,
    title: "Search selected text with…",
    contexts: ["selection"]
  });

  const categories = buildMenuTree(providers);

  for (const category of categories) {
    const categoryId = `${CATEGORY_PREFIX}${category.key}`;
    chrome.contextMenus.create({
      id: categoryId,
      parentId: ROOT_MENU_ID,
      title: category.label,
      contexts: ["selection"]
    });

    for (const entry of category.entries) {
      if (entry.type === "provider") {
        chrome.contextMenus.create({
          id: `${PROVIDER_PREFIX}${entry.provider.id}`,
          parentId: categoryId,
          title: clipTitle(entry.provider.title),
          contexts: ["selection"]
        });
        continue;
      }

      const groupId = `${GROUP_PREFIX}${category.key}:${entry.group.key}`;
      chrome.contextMenus.create({
        id: groupId,
        parentId: categoryId,
        title: clipTitle(entry.group.label),
        contexts: ["selection"]
      });

      for (const provider of entry.group.providers) {
        chrome.contextMenus.create({
          id: `${PROVIDER_PREFIX}${provider.id}`,
          parentId: groupId,
          title: clipTitle(provider.title),
          contexts: ["selection"]
        });
      }
    }
  }
}

function buildMenuTree(providers) {
  const categoryMap = new Map();

  for (const provider of providers) {
    const categoryKey = slugify(provider.categoryLabel || "Other");
    const categoryLabel = provider.categoryLabel || "Other";

    if (!categoryMap.has(categoryKey)) {
      categoryMap.set(categoryKey, {
        key: categoryKey,
        label: categoryLabel,
        providers: []
      });
    }

    categoryMap.get(categoryKey).providers.push(provider);
  }

  return [...categoryMap.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((category) => {
      const hostMap = new Map();

      for (const provider of category.providers.sort((a, b) => a.title.localeCompare(b.title))) {
        const hostKey = provider.groupKey || provider.host || provider.id;
        if (!hostMap.has(hostKey)) {
          hostMap.set(hostKey, {
            key: slugify(hostKey),
            label: provider.groupLabel || provider.host || provider.title,
            providers: []
          });
        }
        hostMap.get(hostKey).providers.push(provider);
      }

      const entries = [...hostMap.values()]
        .sort((a, b) => a.label.localeCompare(b.label))
        .flatMap((group) => {
          if (group.providers.length <= 1) {
            return [{ type: "provider", provider: group.providers[0] }];
          }
          group.providers.sort((a, b) => a.title.localeCompare(b.title));
          return [{ type: "group", group }];
        });

      return {
        key: category.key,
        label: category.label,
        entries
      };
    });
}

function extractProviders(config) {
  if (Array.isArray(config)) {
    return normalizeLegacyProviders(config);
  }

  if (config && Array.isArray(config.providers)) {
    return normalizeLegacyProviders(config.providers);
  }

  if (config && Array.isArray(config.finalists)) {
    return normalizeFinalistProviders(config.finalists);
  }

  return [];
}

function normalizeLegacyProviders(input) {
  const seen = new Set();
  const normalized = [];

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = String(item.id ?? "").trim();
    const title = String(item.title ?? "").trim();
    const urlTemplate = String(item.urlTemplate ?? "").trim();

    if (!id || !title || !urlTemplate || seen.has(id)) {
      continue;
    }

    seen.add(id);

    let host = "misc";
    try {
      host = new URL(urlTemplate.replaceAll("{text}", "x").replaceAll("{raw}", "x")).hostname.replace(/^www\./, "");
    } catch (_error) {
      // keep fallback host
    }

    normalized.push({
      id,
      title,
      urlTemplate,
      enabled: item.enabled !== false,
      openInBackground: item.openInBackground === true,
      categoryLabel: humanizeCategory(item.category || "custom providers"),
      host,
      groupKey: host,
      groupLabel: host,
      filters: {
        trim: item.filters?.trim !== false,
        collapseWhitespace: item.filters?.collapseWhitespace !== false,
        lowercase: item.filters?.lowercase === true,
        uppercase: item.filters?.uppercase === true,
        encoding: normalizeEncoding(item.filters?.encoding),
        regexReplacements: normalizeRegexReplacements(item.filters?.regexReplacements)
      }
    });
  }

  return normalized;
}

function normalizeFinalistProviders(input) {
  const prelim = [];
  const seen = new Set();

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = String(item.id ?? "").trim();
    const siteName = String(item.site_name ?? "").trim();
    const title = String(item.label ?? item.site_name ?? item.id ?? "").trim();
    const urlTemplate = String(item.url_template ?? "").trim();

    if (!id || !title || !urlTemplate || seen.has(id)) {
      continue;
    }

    let host = "misc";
    try {
      const probeUrl = urlTemplate
        .replaceAll("{query}", "x")
        .replaceAll("{text}", "x")
        .replaceAll("{raw}", "x")
        .replaceAll("{path_term}", "x")
        .replaceAll("{path_segment}", "x")
        .replaceAll("{normalized_extension}", "x")
        .replaceAll("{field_query}", "x");
      host = new URL(probeUrl).hostname.replace(/^www\./, "");
    } catch (_error) {
      // keep fallback host
    }

    seen.add(id);
    prelim.push({
      id,
      title,
      siteName,
      urlTemplate,
      enabled: item.enabled !== false,
      openInBackground: item.openInBackground === true,
      categoryLabel: humanizeCategory(item.category || "other"),
      host,
      groupKey: host,
      groupLabel: host,
      filters: deriveFiltersFromStringPrep(item.string_prep)
    });
  }

  const byHost = new Map();
  for (const provider of prelim) {
    if (!byHost.has(provider.host)) {
      byHost.set(provider.host, []);
    }
    byHost.get(provider.host).push(provider);
  }

  for (const group of byHost.values()) {
    const label = deriveGroupLabel(group);
    for (const provider of group) {
      provider.groupLabel = label;
    }
  }

  return prelim;
}

function deriveFiltersFromStringPrep(stringPrep) {
  const mode = String(stringPrep?.mode ?? "query_param").trim();
  const steps = Array.isArray(stringPrep?.steps) ? stringPrep.steps.map((step) => String(step).toLowerCase()) : [];

  const filters = {
    trim: true,
    collapseWhitespace: true,
    lowercase: false,
    uppercase: false,
    encoding: "url",
    regexReplacements: []
  };

  if (["query_param", "query_param_operator_preserving"].includes(mode)) {
    filters.encoding = "plus";
  }

  if (["path_segment", "path_like_search_string", "normalized_extension_path_segment"].includes(mode)) {
    filters.encoding = "url";
  }

  if (steps.some((step) => step.includes("lowercase"))) {
    filters.lowercase = true;
  }

  if (steps.some((step) => step.includes("uppercase"))) {
    filters.uppercase = true;
  }

  return filters;
}

function normalizeEncoding(value) {
  const supported = new Set(["url", "plus", "none"]);
  return supported.has(value) ? value : "url";
}

function normalizeRegexReplacements(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      pattern: String(entry.pattern ?? ""),
      flags: String(entry.flags ?? ""),
      replacement: String(entry.replacement ?? "")
    }))
    .filter((entry) => entry.pattern.length > 0);
}

function buildUrl(provider, selectedText) {
  const filtered = applyFilters(String(selectedText ?? ""), provider.filters ?? {});
  if (!filtered) {
    return null;
  }

  const replacements = {
    raw: filtered,
    text: encodeValue(filtered, provider.filters?.encoding ?? "url"),
    query: encodeValue(filtered, "plus"),
    field_query: encodeValue(filtered, "plus"),
    path_term: encodeValue(filtered, "url"),
    path_segment: encodeValue(filtered, "url"),
    normalized_extension: encodeValue(normalizeExtension(filtered), "url")
  };

  let url = provider.urlTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    url = url.replaceAll(`{${key}}`, value);
  }

  return url;
}

function applyFilters(value, filters) {
  let output = String(value ?? "");

  if (filters.trim !== false) {
    output = output.trim();
  }

  if (filters.collapseWhitespace !== false) {
    output = output.replace(/\s+/g, " ");
  }

  for (const rule of normalizeRegexReplacements(filters.regexReplacements)) {
    try {
      output = output.replace(new RegExp(rule.pattern, rule.flags), rule.replacement);
    } catch (_error) {
      // Ignore invalid regex rules so one bad entry doesn't break the extension.
    }
  }

  if (filters.lowercase === true) {
    output = output.toLowerCase();
  }

  if (filters.uppercase === true) {
    output = output.toUpperCase();
  }

  return output;
}

function normalizeExtension(value) {
  return String(value ?? "").trim().replace(/^\.+/, "").toLowerCase();
}

function encodeValue(value, encoding) {
  if (encoding === "none") {
    return value;
  }

  const encoded = encodeURIComponent(value);

  if (encoding === "plus") {
    return encoded.replace(/%20/g, "+");
  }

  return encoded;
}

function humanizeCategory(value) {
  return String(value ?? "Other")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deriveGroupLabel(providers) {
  const siteNames = providers.map((provider) => provider.siteName).filter(Boolean);
  const prefix = commonPrefix(siteNames).replace(/[\s\-/:,(]+$/, "").trim();
  if (prefix.length >= 4) {
    return prefix;
  }
  return providers[0]?.host || "Related sites";
}

function commonPrefix(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }

  let prefix = values[0];
  for (let index = 1; index < values.length; index += 1) {
    while (prefix && !values[index].startsWith(prefix)) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) {
      break;
    }
  }
  return prefix;
}

function slugify(value) {
  return String(value ?? "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function clipTitle(value, maxLength = 72) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
