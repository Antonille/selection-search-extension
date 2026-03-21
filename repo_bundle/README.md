
# repo_bundle compatibility wrapper

This folder preserves the older package entry point you used before.

It does **not** contain a second full copy of the project. Instead, its scripts target the parent `selection-search-extension` directory so the live project root is what gets validated, committed, and pushed.

## Use

From this folder, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1
```

That wrapper will:
1. move to the parent project root
2. invoke `..\scripts\publish-github.ps1`
3. publish/manage the actual current project files

## Why this layout

Keeping only one live project tree avoids drift between:
- the extension files you are editing
- the files that get committed and pushed

So this folder exists purely for compatibility and convenience.
