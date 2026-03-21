
# Repository management in v2

The v2 package keeps the Chrome extension files at the project root and adds the GitHub-management utilities directly to that same root.

## Recommended workflow

Run repository operations from the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1
```

This script:
- checks `gh` authentication
- scans for likely secrets in the working tree and reachable git history
- validates the extension structure
- initializes git if needed
- commits changes
- creates or updates the GitHub repository
- pushes `main`
- applies branch protection

## Compatibility workflow via `repo_bundle`

To preserve the older package structure, `repo_bundle/scripts/publish-github.ps1` is included as a thin wrapper.

Run it from inside `repo_bundle`:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\publish-github.ps1
```

That wrapper changes directory to the parent project root and runs the real publish script there. This keeps the old entry point available without maintaining a second full project copy inside `repo_bundle`.
