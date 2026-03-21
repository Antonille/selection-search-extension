# Install / Update Directions

## Fresh install

1. Unzip the folder.
2. Open Chrome to `chrome://extensions/`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select the folder containing `manifest.json`.

## Updating an existing unpacked install

1. Close the extension Options page if it is open.
2. Replace the old unpacked folder contents with this revision.
3. In `chrome://extensions/`, click **Reload** for Selection Search Launcher.

## Make a new packaged JSON file take effect

This revision uses `providers.default.json` as the live default. To swap in a new packaged JSON file:

1. Replace `providers.default.json` in the unpacked folder.
2. Click **Reload** in `chrome://extensions/`.
3. If you had previously saved or imported a local override, open the Options page and click **Clear override / use packaged defaults**.

## Import a one-off custom JSON without replacing the packaged file

1. Open the extension Options page.
2. Click **Import JSON override**.
3. Select the JSON file.
4. The imported JSON becomes the active local override until you clear it.

## Validate a JSON file before loading it

```powershell
python .\validate_providers.py .\providers.default.json
```


## GitHub publish / management

Recommended:
1. Open PowerShell in the project root.
2. Run `powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1`

Compatibility entry point:
- You can also keep your older workflow and run `repo_bundle\scripts\publish-github.ps1`, which wraps the root publish script.
