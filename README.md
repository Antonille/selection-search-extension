# Selection Search Extension

A drop-in Chrome extension that lets you highlight text on any page, right-click, and launch the selected text into a site-specific search URL.

This project is designed for people who want a useful tool quickly, without a Node build step, package installation, or extension-store publishing workflow.

## What it does

- Adds a right-click menu for highlighted text.
- Groups search targets into categories so the menu stays manageable.
- Creates nested submenus for related sites on the same domain when needed.
- Opens the chosen search in a new tab using your configured URL template.
- Lets you edit, import, export, and reset the search-provider JSON from the built-in Options page.

## Features

- Chrome Manifest V3 extension
- No build step required
- JSON-based provider configuration
- Grouped context-menu layout
- Support for both simple provider arrays and richer `finalists` JSON documents
- Optional Python validator for JSON config files
- Optional Node validation and secret-scan scripts for repository hygiene

## Screenshots / GIFs

Add screenshots here when you are ready:

- `docs/images/context-menu-placeholder.png`
- `docs/images/options-page-placeholder.png`
- `docs/images/grouped-submenu-placeholder.png`

## Quick install (Load unpacked)

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that contains `manifest.json`.
6. Highlight text on a web page, right-click, and use **Search selected text with…**.

## Usage

1. Select a word or phrase on any page.
2. Right-click the selected text.
3. Open **Search selected text with…**.
4. Choose a category.
5. Choose a site or site-family submenu.
6. A new tab opens with the selected text inserted into that search target.

## Configuration

### Easiest method: Options page

1. Open `chrome://extensions/`.
2. Find **Selection Search Extension**.
3. Click **Details**.
4. Click **Extension options**.
5. Edit the JSON and click **Save**.

You can also:
- **Reset to defaults**
- **Export JSON**
- **Import JSON**

### File-based method

Edit one of these files directly:

- `providers.default.json` - packaged default configuration
- `providers.custom.example.json` - example alternative config

After editing the file, reload the extension in `chrome://extensions/`.

## Supported config styles

### 1) Simple provider array

```json
[
  {
    "id": "google",
    "title": "Google",
    "enabled": true,
    "openInBackground": false,
    "urlTemplate": "https://www.google.com/search?q={text}",
    "filters": {
      "trim": true,
      "collapseWhitespace": true,
      "encoding": "url",
      "regexReplacements": []
    }
  }
]
```

### 2) Rich `finalists` config

The extension also accepts an object with a `finalists` array. That format is useful when you want to store richer metadata about each target site, such as labels, categories, grouping hints, string preparation rules, and URL templates.

## Placeholder support

The URL builder understands these placeholders:

- `{text}` - filtered and encoded text
- `{raw}` - filtered but unencoded text
- `{query}` - query-safe text with spaces converted for query use
- `{field_query}` - alias of query-style handling
- `{path_term}` - path-segment encoding
- `{path_segment}` - path-segment encoding
- `{normalized_extension}` - leading dot removed, lowercased, then encoded

## Permissions rationale

This extension intentionally requests only a small set of permissions:

- `contextMenus` - needed to add the right-click menu for selected text
- `storage` - needed to save your editable JSON config in extension storage

It does **not** request broad website access or blanket host permissions.

## Repository validation

This repository includes lightweight validation scripts with no external npm dependencies.

### Validate the extension structure

```powershell
node .\scripts\validate-extension.mjs
```

### Scan for likely secrets before publishing

```powershell
node .\scripts\scan-secrets.mjs
```

If the repository already has git history, the secret scanner also checks reachable git blobs.

### Optional Python config validation

```powershell
python .\validate_providers.py .\providers.default.json
```

## Convenience script

To open the extension folder and Chrome's extension page from PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\Open-Chrome-Extensions.ps1
```

## Troubleshooting

### The menu does not appear

- Make sure the extension is enabled.
- Make sure you actually highlighted text before right-clicking.
- Reload the extension after changing config files.

### I changed the JSON file but the menu did not update

- If you edited the file on disk, reload the extension.
- If you edited in the Options page, click **Save**.

### I see duplicate context-menu errors

Use the current version of `background.js` in this repository. Earlier builds could rebuild the menu twice and trigger duplicate menu IDs.

### My import fails

- Make sure the JSON is valid.
- Make sure the top-level document is either:
  - an array of providers
  - an object containing `providers`
  - an object containing `finalists`

### A search target opens the wrong URL

Check:
- the target's `urlTemplate` or `url_template`
- its placeholder usage
- any trimming, replacement, or encoding rules

## Security

Please see [SECURITY.md](SECURITY.md).

## License

MIT. See [LICENSE](LICENSE).
