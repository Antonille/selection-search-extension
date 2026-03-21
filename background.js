const DEFAULTS_PATH = "providers.default.json";
const OVERRIDE_KEY = "configOverrideDocument";
const ROOT_MENU_ID = "selection-search-root";
const CATEGORY_PREFIX = "category:";
const GROUP_PREFIX = "group:";
const PROVIDER_PREFIX = "provider:";

let rebuildQueue = Promise.resolve();
let defaultConfigCache = null;

chrome.runtime.onInstalled.addListener(async () => {
  await queueContextMenuRebuild();
});

chrome.runtime.onStartup.addListener(async () => {
  await queueContextMenuRebuild();
});

chrome.storage.onChanged.addListener(async (_changes, areaName) => {
  if (areaName === "local") {
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
    console.warn("Selection Search: could not build URL for provider", provider.id);
    return;
  }

  const strategy = provider.resultHandling?.browserStrategy || "direct";
  if (strategy === "launchpad") {
    const launchUrl = chrome.runtime.getURL(
      `launch.html?resourceId=${encodeURIComponent(provider.id)}&target=${encodeURIComponent(url)}`
    );

    await chrome.tabs.create({
      url: launchUrl,
      active: provider.openInBackground ? false : true
    });
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

async function getOverrideConfig() {
  const stored = await chrome.storage.local.get(OVERRIDE_KEY);
  const value = stored[OVERRIDE_KEY];
  return isSupportedConfig(value) ? value : null;
}

async function getRawConfig() {
  const override = await getOverrideConfig();
  if (override) {
    return override;
  }
  return loadDefaultConfig();
}

async function getProviders() {
  const config = await getRawConfig();
  return extractProviders(config);
}

async function loadDefaultConfig(force = false) {
  if (defaultConfigCache && !force) {
    return defaultConfigCache;
  }
  const response = await fetch(chrome.runtime.getURL(DEFAULTS_PATH), { cache: "no-store" });
  defaultConfigCache = await response.json();
  return defaultConfigCache;
}

function isSupportedConfig(value) {
  return Array.isArray(value) || !!(value && typeof value === "object" && !Array.isArray(value));
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
      title: clipTitle(category.label),
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
        order: provider.categoryOrder ?? 1000,
        providers: []
      });
    }

    categoryMap.get(categoryKey).providers.push(provider);
  }

  return [...categoryMap.values()]
    .sort((a, b) => compareNumbers(a.order, b.order) || a.label.localeCompare(b.label))
    .map((category) => {
      const groupMap = new Map();

      for (const provider of category.providers.sort(compareProviders)) {
        const groupKey = provider.groupKey || provider.host || provider.id;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            key: slugify(groupKey),
            label: provider.groupLabel || provider.host || provider.title,
            order: provider.groupOrder ?? 1000,
            providers: []
          });
        }

        groupMap.get(groupKey).providers.push(provider);
      }

      const entries = [...groupMap.values()]
        .sort((a, b) => compareNumbers(a.order, b.order) || a.label.localeCompare(b.label))
        .flatMap((group) => {
          if (group.providers.length <= 1) {
            return [{ type: "provider", provider: group.providers[0] }];
          }
          group.providers.sort(compareProviders);
          return [{ type: "group", group }];
        });

      return {
        key: category.key,
        label: category.label,
        entries
      };
    });
}

function compareProviders(a, b) {
  return compareNumbers(a.menuOrder ?? 1000, b.menuOrder ?? 1000) || a.title.localeCompare(b.title);
}

function compareNumbers(a, b) {
  return Number(a ?? 0) - Number(b ?? 0);
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

  if (config && Array.isArray(config.resources)) {
    return normalizeResourceSpecProviders(config.resources);
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

    const host = safeHostnameFromTemplate(urlTemplate);
    normalized.push({
      id,
      title,
      siteName: title,
      urlTemplate,
      enabled: item.enabled !== false,
      openInBackground: item.openInBackground === true,
      categoryLabel: humanizeCategory(item.category || "custom providers"),
      categoryOrder: Number(item.menu?.categoryOrder ?? 1000),
      groupKey: item.menu?.groupKey || host,
      groupLabel: item.menu?.groupLabel || host,
      groupOrder: Number(item.menu?.groupOrder ?? 1000),
      menuOrder: Number(item.menu?.order ?? 1000),
      host,
      placeholderBindings: legacyBindingsFromFilters(item.filters),
      resultHandling: {
        resultFormat: "html",
        browserStrategy: "direct",
        notesForUser: []
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
    const title = String(item.label ?? item.site_name ?? item.id ?? "").trim();
    const urlTemplate = String(item.url_template ?? "").trim();

    if (!id || !title || !urlTemplate || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const host = safeHostnameFromTemplate(urlTemplate);
    prelim.push({
      id,
      title,
      siteName: String(item.site_name ?? "").trim(),
      urlTemplate,
      enabled: item.enabled !== false,
      openInBackground: item.openInBackground === true,
      categoryLabel: humanizeCategory(item.category || "other"),
      categoryOrder: 1000,
      groupKey: host,
      groupLabel: host,
      groupOrder: 1000,
      menuOrder: 1000,
      host,
      placeholderBindings: placeholderBindingsFromLegacyFinalist(item),
      resultHandling: normalizeResultHandling({
        result_format: item.result_format,
        browser_strategy: item.result_format === "html" ? "direct" : "launchpad",
        notes_for_user: item.result_format === "html"
          ? []
          : [`This resource returns ${String(item.result_format || "structured").toUpperCase()} instead of a regular HTML page.`]
      })
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

function normalizeResourceSpecProviders(input) {
  const normalized = [];
  const seen = new Set();

  for (const item of input) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const id = String(item.id ?? "").trim();
    const urlTemplate = String(item.url?.template ?? item.url_template ?? "").trim();
    const title = String(
      item.menu?.title ??
      item.resource?.resource_label ??
      item.resource?.site_name ??
      item.label ??
      item.site_name ??
      id
    ).trim();

    if (!id || !title || !urlTemplate || seen.has(id)) {
      continue;
    }

    seen.add(id);
    const host = safeHostnameFromTemplate(urlTemplate);

    normalized.push({
      id,
      title,
      siteName: String(item.resource?.site_name ?? item.site_name ?? title).trim(),
      urlTemplate,
      enabled: item.enabled !== false && item.status !== "disabled",
      openInBackground: item.openInBackground === true,
      categoryLabel: String(item.menu?.category_label ?? humanizeCategory(item.resource?.category ?? "other")).trim(),
      categoryOrder: Number(item.menu?.category_order ?? 1000),
      groupKey: String(item.menu?.group_key ?? item.menu?.group_label ?? host).trim(),
      groupLabel: String(item.menu?.group_label ?? host).trim(),
      groupOrder: Number(item.menu?.group_order ?? 1000),
      menuOrder: Number(item.menu?.order ?? 1000),
      host,
      placeholderBindings: normalizePlaceholderBindings(item.url?.placeholders, urlTemplate),
      resultHandling: normalizeResultHandling(item.result_handling)
    });
  }

  return normalized;
}

function normalizeResultHandling(input) {
  const resultFormat = String(input?.result_format ?? "html").trim() || "html";
  const browserStrategy = String(input?.browser_strategy ?? (resultFormat === "html" ? "direct" : "launchpad")).trim() || "direct";

  return {
    resultFormat,
    browserStrategy,
    contentTypeHint: String(input?.content_type_hint ?? "").trim(),
    displayHint: String(input?.display_hint ?? "").trim(),
    notesForUser: normalizeStringArray(input?.notes_for_user),
    futureHooks: normalizeStringArray(input?.future_hooks)
  };
}

function placeholderBindingsFromLegacyFinalist(item) {
  const template = String(item.url_template ?? "").trim();
  const mode = String(item.string_prep?.mode ?? "query_param").trim();
  const bindings = {};
  const placeholders = extractPlaceholders(template);

  for (const name of placeholders) {
    bindings[name] = {
      source: "selected_text",
      pipeline: defaultPipelineForPlaceholder(name, mode)
    };

    if (mode === "query_param_operator_preserving" && ["query", "field_query"].includes(name)) {
      bindings[name].preserveOperators = true;
    }
  }

  return bindings;
}

function defaultPipelineForPlaceholder(placeholderName, legacyMode = "query_param") {
  if (placeholderName === "normalized_extension") {
    return ["trim", "strip_leading_dots", "lowercase", "encode_path_segment"];
  }

  if (["path_term", "path_segment"].includes(placeholderName)) {
    return ["trim", "collapse_whitespace", "encode_path_segment"];
  }

  if (placeholderName === "raw") {
    return ["trim", "collapse_whitespace"];
  }

  if (["query", "field_query", "text"].includes(placeholderName)) {
    return ["trim", "collapse_whitespace", "encode_query_param_plus"];
  }

  if (legacyMode === "normalized_extension_path_segment") {
    return ["trim", "strip_leading_dots", "lowercase", "encode_path_segment"];
  }

  if (["path_segment", "path_like_search_string"].includes(legacyMode)) {
    return ["trim", "collapse_whitespace", "encode_path_segment"];
  }

  return ["trim", "collapse_whitespace", "encode_query_param_plus"];
}

function normalizePlaceholderBindings(input, urlTemplate) {
  const output = {};
  const placeholders = extractPlaceholders(urlTemplate);

  for (const placeholder of placeholders) {
    const spec = input?.[placeholder];
    if (spec && typeof spec === "object" && !Array.isArray(spec)) {
      output[placeholder] = {
        source: String(spec.source ?? "selected_text").trim() || "selected_text",
        pipeline: normalizePipeline(spec.pipeline),
        defaultValue: spec.default_value ?? "",
        preserveOperators: spec.preserve_operators === true
      };
    } else {
      output[placeholder] = {
        source: "selected_text",
        pipeline: defaultPipelineForPlaceholder(placeholder),
        defaultValue: "",
        preserveOperators: false
      };
    }
  }

  return output;
}

function normalizePipeline(pipeline) {
  if (!Array.isArray(pipeline)) {
    return [];
  }

  return pipeline
    .map((step) => {
      if (typeof step === "string") {
        return step.trim();
      }
      if (step && typeof step === "object" && !Array.isArray(step) && typeof step.op === "string") {
        return {
          op: step.op.trim(),
          pattern: String(step.pattern ?? ""),
          flags: String(step.flags ?? ""),
          replacement: String(step.replacement ?? ""),
          value: step.value ?? ""
        };
      }
      return null;
    })
    .filter(Boolean);
}

function legacyBindingsFromFilters(filters) {
  return {
    text: {
      source: "selected_text",
      pipeline: legacyPipelineFromFilters(filters, filters?.encoding ?? "url")
    },
    raw: {
      source: "selected_text",
      pipeline: legacyPipelineFromFilters(filters, "none")
    }
  };
}

function legacyPipelineFromFilters(filters, encoding = "url") {
  const pipeline = [];
  if (filters?.trim !== false) {
    pipeline.push("trim");
  }
  if (filters?.collapseWhitespace !== false) {
    pipeline.push("collapse_whitespace");
  }

  for (const rule of normalizeRegexReplacements(filters?.regexReplacements)) {
    pipeline.push({
      op: "regex_replace",
      pattern: rule.pattern,
      flags: rule.flags,
      replacement: rule.replacement
    });
  }

  if (filters?.lowercase === true) {
    pipeline.push("lowercase");
  }

  if (filters?.uppercase === true) {
    pipeline.push("uppercase");
  }

  if (encoding === "plus") {
    pipeline.push("encode_query_param_plus");
  } else if (encoding === "url") {
    pipeline.push("encode_path_segment");
  }

  return pipeline;
}

function safeHostnameFromTemplate(urlTemplate) {
  try {
    let probeUrl = String(urlTemplate ?? "");
    for (const placeholder of extractPlaceholders(probeUrl)) {
      probeUrl = probeUrl.replaceAll(`{${placeholder}}`, "x");
    }
    return new URL(probeUrl).hostname.replace(/^www\./, "");
  } catch (_error) {
    return "misc";
  }
}

function buildUrl(provider, selectedText) {
  const sourceValue = String(selectedText ?? "");

  if (!sourceValue.trim()) {
    return null;
  }

  const replacements = {};
  const placeholders = extractPlaceholders(provider.urlTemplate);

  for (const placeholderName of placeholders) {
    const binding = provider.placeholderBindings?.[placeholderName] ?? {
      source: "selected_text",
      pipeline: defaultPipelineForPlaceholder(placeholderName),
      defaultValue: ""
    };

    let value = sourceValue;
    value = applyPipeline(value, binding.pipeline);

    if (!String(value).length) {
      value = String(binding.defaultValue ?? "");
    }

    if (!String(value).length) {
      return null;
    }

    replacements[placeholderName] = value;
  }

  let url = provider.urlTemplate;
  for (const [key, value] of Object.entries(replacements)) {
    url = url.replaceAll(`{${key}}`, value);
  }

  if (/\{[a-zA-Z0-9_]+\}/.test(url)) {
    console.warn("Selection Search: unresolved placeholder(s) remain in URL template", provider.id, url);
    return null;
  }

  return url;
}

function applyPipeline(value, pipeline) {
  let output = String(value ?? "");
  const normalizedPipeline = normalizePipeline(pipeline);

  for (const step of normalizedPipeline) {
    if (typeof step === "string") {
      output = applyOperation(output, { op: step });
      continue;
    }
    output = applyOperation(output, step);
  }

  return output;
}

function applyOperation(value, step) {
  let output = String(value ?? "");
  const op = String(step?.op ?? step ?? "").trim();

  switch (op) {
    case "normalize_unicode_nfkc":
      return output.normalize("NFKC");
    case "trim":
      return output.trim();
    case "collapse_whitespace":
      return output.replace(/\s+/g, " ");
    case "lowercase":
      return output.toLowerCase();
    case "uppercase":
      return output.toUpperCase();
    case "strip_leading_dot":
    case "strip_leading_dots":
      return output.replace(/^\.+/, "");
    case "strip_wrapping_quotes":
      return output.replace(/^[“”"'`]+/, "").replace(/[“”"'`]+$/, "");
    case "regex_replace":
      try {
        return output.replace(new RegExp(String(step.pattern ?? ""), String(step.flags ?? "")), String(step.replacement ?? ""));
      } catch (_error) {
        return output;
      }
    case "encode_query_param_plus":
      return encodeURIComponent(output).replace(/%20/g, "+");
    case "encode_query_param":
      return encodeURIComponent(output);
    case "encode_path_segment":
      return encodeURIComponent(output);
    case "encode_none":
    case "none":
      return output;
    default:
      return output;
  }
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

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function extractPlaceholders(template) {
  const matches = String(template ?? "").match(/\{[a-zA-Z0-9_]+\}/g) ?? [];
  return [...new Set(matches.map((item) => item.slice(1, -1)))];
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
