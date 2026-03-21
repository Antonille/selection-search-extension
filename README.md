# Selection Search Launcher

A drop-in Chrome extension that lets you highlight text, right-click, choose from a grouped search menu, and launch a URL built from a JSON resource specification.

## What changed in this revision

- Uses the packaged `providers.default.json` file as the live default again.
- Local storage now acts only as an **override**, so replacing the JSON file in the unpacked folder and clicking **Reload** actually changes extension behavior.
- Adds a **v2 resource specification** with explicit placeholder pipelines, menu metadata, examples, and result-handling metadata.
- Adds a **launch page** for JSON/XML and other structured results so the extension can explain what is about to open instead of only dumping raw data in a tab.
- Keeps backwards compatibility with older formats:
  - top-level provider array
  - `{ "providers": [...] }`
  - `{ "finalists": [...] }`
  - `{ "resources": [...] }` (preferred)

## Files

- `manifest.json` — Chrome extension manifest
- `background.js` — context menu builder and URL launcher
- `launch.html`, `launch.js` — launch page for structured or non-HTML results
- `options.html`, `options.js`, `options.css` — in-browser config editor
- `providers.default.json` — packaged default config using the v2 resource spec
- `providers.legacy.finalists.json` — the legacy finalist JSON kept for reference
- `docs/JSON-SPEC-v2.md` — explicit JSON specification for resources
- `docs/RESOURCE-AUDIT.md` — per-resource audit notes
- `docs/LLM-PROMPT-v2.txt` — reusable LLM prompt for generating new resource JSON
- `validate_providers.py` — optional syntax/schema validator

## Install

1. Unzip this folder somewhere permanent.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder that contains `manifest.json`.

Optional helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\Open-Chrome-Extensions.ps1
```

## Use

1. Highlight text on a webpage.
2. Right-click.
3. Choose **Search selected text with…**
4. Pick a category.
5. If needed, pick a site-family submenu.
6. Click the resource.

For HTML resources, the extension opens the target directly.

For JSON/XML and other structured resources, the extension may open a launch page first. The launch page shows:
- expected result format
- notes about the response
- the fully constructed target URL
- buttons to open or copy that URL

## How configuration works now

### Packaged defaults

If you edit `providers.default.json` in the unpacked extension folder and then click **Reload** in `chrome://extensions`, the extension uses that updated JSON immediately.

### Local override

If you use the Options page and click **Save override** or **Import JSON override**, that saved/imported JSON takes precedence over `providers.default.json`.

### Clear override

Use **Clear override / use packaged defaults** in the Options page to go back to the on-disk JSON file.

## Accepted config formats

### Preferred format: v2 resource spec

Top-level object with `resources`.

The v2 spec lets you describe:

- menu category/group/title
- URL template
- placeholder-specific pipelines
- example URLs
- expected result format
- whether the browser should open directly or use the launch page

See:

- `docs/JSON-SPEC-v2.md`
- `docs/LLM-PROMPT-v2.txt`

### Legacy formats still supported

- simple provider array
- object with `providers`
- object with `finalists`

## Placeholder handling

The extension supports explicit placeholder pipelines in the v2 spec.

Useful built-in operations:

- `trim`
- `collapse_whitespace`
- `lowercase`
- `uppercase`
- `strip_leading_dots`
- `strip_wrapping_quotes`
- `regex_replace`
- `encode_query_param_plus`
- `encode_query_param`
- `encode_path_segment`
- `encode_none`

## Why some resources were inconsistent before

The previous grouped build understood the rough URL shape, but it only used a thin subset of the richer JSON semantics. In practice that meant:

- most basic HTML search URLs worked
- operator-preserving searches were only partially modeled
- structured-result endpoints had no special handling
- replacing the packaged JSON file did not take effect unless you also reset/imported the stored config

This revision addresses all four of those problems.

## Optional validation with Python

```powershell
python .\validate_providers.py .\providers.default.json
```

Uses only the Python standard library.


## GitHub repository management

This package now includes the repository-management files needed to publish and maintain the project on GitHub.

Files added for repository management:
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`
- `.gitignore`
- `LICENSE`
- `SECURITY.md`
- `scripts/publish-github.ps1`
- `scripts/scan-secrets.mjs`
- `scripts/validate-extension.mjs`

Preferred path:
1. Open PowerShell in the project root (`selection-search-extension`).
2. Make sure `git` and GitHub CLI `gh` are installed and that `gh auth status` works.
3. Run:
   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1
   ```

Compatibility path:
- If you prefer the old package layout, the `repo_bundle/` folder contains wrapper utilities that call the root publish script against the parent project.
