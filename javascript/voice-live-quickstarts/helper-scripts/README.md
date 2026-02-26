# Helper Scripts — Windows Prerequisites

PowerShell scripts to set up and verify the Windows development environment for the JavaScript Voice Live quickstarts.

These scripts are shared by [ModelQuickstart](../ModelQuickstart/) and [AgentsNewQuickstart](../AgentsNewQuickstart/).

## Scripts

### `check-prereqs.ps1`

Validates that all required tools are installed and reports a pass/fail summary.

**Checks:**

- Node.js 18–22 and npm
- SoX (audio capture)
- Visual Studio C++ Build Tools and Windows SDK (required for native `speaker` module)
- `node-record-lpcm16` and `speaker` npm packages (when run from a quickstart folder)

**Usage** (run from a quickstart folder with `node_modules`):

```powershell
powershell -ExecutionPolicy Bypass -File ..\helper-scripts\check-prereqs.ps1
```

### `setup-windows-prereqs.ps1`

Automated setup that installs all prerequisites via `winget` and `nvm-windows`.

**Installs:**

- `nvm-windows` + Node.js 20 LTS
- SoX for audio capture
- Visual Studio 2022 Build Tools with C++ workload
- npm optional dependencies (`speaker`, `node-record-lpcm16`)

**Usage** (run from a quickstart folder):

```powershell
powershell -ExecutionPolicy Bypass -File ..\helper-scripts\setup-windows-prereqs.ps1
```

**Dry run** (preview actions without installing):

```powershell
powershell -ExecutionPolicy Bypass -File ..\helper-scripts\setup-windows-prereqs.ps1 -DryRun
```

## Parameters

### `setup-windows-prereqs.ps1`

| Parameter | Default | Description |
|---|---|---|
| `-NodeVersion` | `20.18.0` | Node.js version to install via nvm |
| `-SkipWingetInstall` | `$false` | Skip winget-based installs |
| `-SkipNpmInstall` | `$false` | Skip `npm install` |
| `-DryRun` | `$false` | Preview actions without changes |

### `check-prereqs.ps1`

| Parameter | Default | Description |
|---|---|---|
| `-RequireAudioDeps` | `$true` | Check for `speaker` and `node-record-lpcm16` in `node_modules` |

## Notes

- These scripts require **Windows** with **PowerShell 5.1+** and **winget**.
- After running `setup-windows-prereqs.ps1`, you may need to restart your terminal for PATH changes to take effect.
- The scripts are designed to be idempotent — safe to run multiple times.
