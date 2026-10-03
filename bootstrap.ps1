#Requires -Version 5.1
<#
.SYNOPSIS
    Set up this DSH agent-preset repository on a machine that does not have it yet.

.DESCRIPTION
    Checks every prerequisite, clones or updates the repository, syncs the profile configuration
    into place, installs the profile's dependencies, reports which credentials are missing, checks
    the machine-specific paths, and runs the validators.

    Written in PowerShell rather than Node on purpose. Node is one of the things being checked for,
    so a Node bootstrap could not run on the machine that most needs it.

    Nothing is overwritten without a backup: sync-profile.mjs keeps one, and this script only calls
    it.

.PARAMETER Check
    Report only. Change nothing, clone nothing, install nothing.

.PARAMETER Repo
    Repository URL. Defaults to the public one.

.PARAMETER Dest
    Where to put the repository. Defaults to <dshHome>\.agent-presets.

.PARAMETER Profile
    The profile directory to sync into. Defaults to <dshHome>\profiles\web.

.PARAMETER SkipDeps
    Skip pnpm install. Useful when pnpm is not installed and you only want the files.

.EXAMPLE
    .\bootstrap.ps1 -Check
    Show what this machine has and what it is missing.

.EXAMPLE
    .\bootstrap.ps1
    Do the whole setup.
#>
[CmdletBinding()]
param(
    [switch]$Check,
    [string]$Repo = 'https://github.com/studioxy/dsh-agent-presets.git',
    [string]$Dest,
    [string]$Profile,
    [switch]$SkipDeps
)

$ErrorActionPreference = 'Stop'
if (-not $Dest)    { $Dest    = Join-Path $env:USERPROFILE '.dsh\.agent-presets' }
if (-not $Profile) { $Profile = Join-Path $env:USERPROFILE '.dsh\profiles\web' }

$script:Fails = 0
$script:Warns = 0

function Write-Head($text) {
    Write-Host ''
    Write-Host ('=' * 72) -ForegroundColor DarkGray
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host ('=' * 72) -ForegroundColor DarkGray
}
function Write-Ok($text)   { Write-Host "  [ok]   $text" -ForegroundColor Green }
function Write-Bad($text)  { $script:Fails++; Write-Host "  [FAIL] $text" -ForegroundColor Red }
function Write-Warn($text) { $script:Warns++; Write-Host "  [warn] $text" -ForegroundColor Yellow }
function Write-Info($text) { Write-Host "         $text" -ForegroundColor Gray }

function Test-Command($name) {
    $c = Get-Command $name -ErrorAction SilentlyContinue
    if ($c) { return $c.Source }
    return $null
}

# ---------------------------------------------------------------------------
Write-Head '1. Prerequisites'
# ---------------------------------------------------------------------------

# required = the harness or this script cannot work without it.
# optional  = only the presets named in "for" need it.
# Label is what a person reads; Cmd is what Get-Command looks up. They differ for Node.js, whose
# executable is "node", and for Chrome, which does not put itself on PATH under any name.
$prereqs = @(
    [pscustomobject]@{ Label='Node.js'; Cmd='node';   Version='--version'; Required=$true;  For='the harness itself'; Winget='OpenJS.NodeJS.LTS' }
    [pscustomobject]@{ Label='git';     Cmd='git';    Version='--version'; Required=$true;  For='cloning this repository'; Winget='Git.Git' }
    [pscustomobject]@{ Label='pnpm';    Cmd='pnpm';   Version='--version'; Required=$true;  For='linking the profile bundles'; Winget='pnpm.pnpm' }
    [pscustomobject]@{ Label='Python';  Cmd='python'; Version='--version'; Required=$false; For='docs (pdf), excel-pq scripts'; Winget='Python.Python.3.12' }
    [pscustomobject]@{ Label='uv';      Cmd='uv';     Version='--version'; Required=$false; For='docs venv, excel-pq MCPs'; Winget='astral-sh.uv' }
    [pscustomobject]@{ Label='Chrome';  Cmd=$null;    Version=$null;       Required=$false; For='docs (render and audit)'; Winget='Google.Chrome' }
    [pscustomobject]@{ Label='serena';  Cmd='serena'; Version='--version'; Required=$false; For='coding (code intelligence)'; Winget=$null }
    [pscustomobject]@{ Label='gopls';   Cmd='gopls';  Version='version';   Required=$false; For='coding, Go language server'; Winget=$null }
    [pscustomobject]@{ Label='gh';      Cmd='gh';     Version='--version'; Required=$false; For='pushing updates to GitHub'; Winget='GitHub.cli' }
    [pscustomobject]@{ Label='rtk';     Cmd='rtk';    Version='--version'; Required=$false; For='token economy on shell output'; Winget=$null }
)

$missing = @()
foreach ($p in $prereqs) {
    if ($p.Label -eq 'Chrome') {
        # Chrome does not register a command; look for the executable in the usual places.
        $chromePaths = @(
            "$env:ProgramFiles\Google\Chrome\Application\chrome.exe"
            "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
            "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
        )
        $found = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
        if ($found) {
            Write-Ok ("{0,-9} {1}" -f $p.Label, $found)
        } else {
            $missing += $p
            Write-Warn ("{0,-9} brak - potrzebne dla: {1}" -f $p.Label, $p.For)
            Write-Info "zainstaluj:  winget install --id $($p.Winget) -e"
        }
        continue
    }

    $exe = Test-Command $p.Cmd
    if ($exe) {
        $ver = ''
        try { $ver = (& $p.Cmd $p.Version 2>&1 | Select-Object -First 1) } catch { }
        Write-Ok ("{0,-9} {1}" -f $p.Label, "$ver")
    } else {
        $missing += $p
        if ($p.Required) {
            Write-Bad ("{0,-9} brak - wymagane dla: {1}" -f $p.Label, $p.For)
        } else {
            Write-Warn ("{0,-9} brak - potrzebne dla: {1}" -f $p.Label, $p.For)
        }
        if ($p.Winget) { Write-Info "zainstaluj:  winget install --id $($p.Winget) -e" }
        else           { Write-Info "zainstaluj recznie - brak w winget" }
    }
}

$requiredMissing = @($missing | Where-Object { $_.Required })
if ($requiredMissing.Count -gt 0) {
    Write-Host ''
    Write-Bad "$($requiredMissing.Count) wymaganych narzedzi brakuje. Zainstaluj je i uruchom ponownie."
    Write-Info ($requiredMissing.Name -join ', ')
    exit 1
}

# ---------------------------------------------------------------------------
Write-Head '2. Repository'
# ---------------------------------------------------------------------------

if (Test-Path (Join-Path $Dest '.git')) {
    Write-Ok "repozytorium juz jest: $Dest"
    if (-not $Check) {
        Push-Location $Dest
        try {
            $before = (git rev-parse HEAD)
            git fetch --quiet origin 2>&1 | Out-Null
            $behind = (git rev-list --count "HEAD..@{upstream}" 2>$null)
            if ($behind -and [int]$behind -gt 0) {
                Write-Info "$behind nowych commitow na zdalnym - pobieram"
                git pull --ff-only --quiet 2>&1 | Out-Null
                $after = (git rev-parse HEAD)
                Write-Ok "zaktualizowano $($before.Substring(0,8)) -> $($after.Substring(0,8))"
            } else {
                Write-Ok "aktualne ($($before.Substring(0,8)))"
            }
        } catch {
            Write-Warn "nie udalo sie zaktualizowac: $_"
        } finally { Pop-Location }
    }
} else {
    if ($Check) {
        Write-Warn "repozytorium nieobecne - zostanie sklonowane do $Dest"
    } else {
        Write-Info "klonuje $Repo"
        $parent = Split-Path $Dest -Parent
        if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
        git clone $Repo $Dest 2>&1 | Select-Object -Last 3 | ForEach-Object { Write-Info $_ }
        if (-not (Test-Path (Join-Path $Dest '.git'))) { Write-Bad 'klonowanie nie powiodlo sie'; exit 1 }
        Write-Ok "sklonowane do $Dest"
    }
}

if ($Check) { $Dest = $Dest }  # keep the path for the checks below even when nothing was cloned

# ---------------------------------------------------------------------------
Write-Head '3. Profile configuration'
# ---------------------------------------------------------------------------

$sync = Join-Path $Dest 'sync-profile.mjs'
if (-not (Test-Path $sync)) {
    Write-Bad "brak sync-profile.mjs w $Dest"
} elseif (-not (Test-Path $Profile)) {
    Write-Warn "profil nie istnieje: $Profile"
    if ($Check) {
        Write-Info '--apply utworzy go z plikow w repozytorium'
    } else {
        Write-Info 'tworze go z plikow w repozytorium'
        node $sync --dest $Profile --apply 2>&1 | ForEach-Object { Write-Info $_ }
        Write-Ok 'profil utworzony'
    }
} elseif ($Check) {
    Write-Info 'tryb -Check: pokazuje roznice, nic nie zapisuje'
    node $sync --dest $Profile 2>&1 | ForEach-Object { Write-Info $_ }
} else {
    node $sync --dest $Profile --apply 2>&1 | ForEach-Object { Write-Info $_ }
    Write-Ok 'profil zsynchronizowany (kopie zapasowe w .backup-*)'
}

# ---------------------------------------------------------------------------
Write-Head '4. Profile dependencies'
# ---------------------------------------------------------------------------

if ($SkipDeps) {
    Write-Warn 'pominieto (-SkipDeps)'
} elseif (-not (Test-Path $Profile)) {
    Write-Warn 'brak katalogu profilu - pomijam'
} elseif ($Check) {
    Write-Info "do wykonania:  pnpm --dir `"$Profile`" install"
} else {
    Write-Info 'pnpm install'
    pnpm --dir $Profile install 2>&1 | Select-Object -Last 8 | ForEach-Object { Write-Info $_ }
    $local = Join-Path $Profile 'node_modules\@local'
    if (Test-Path $local) {
        $n = (Get-ChildItem $local -Directory | Measure-Object).Count
        if ($n -ge 5) { Write-Ok "$n bundle'i podlaczone" } else { Write-Warn "tylko $n bundle'i - oczekiwano 5" }
    } else {
        Write-Bad 'brak node_modules\@local - bundle nie sa podlaczone'
    }
}

# ---------------------------------------------------------------------------
Write-Head '5. Credentials'
# ---------------------------------------------------------------------------

$credFile = Join-Path $env:USERPROFILE '.dsh\.credentials.yaml'
# Which references the profile actually names. Read from the patch rather than hard-coded.
$needed = @()
$patchPath = Join-Path $Profile 'cordis.patch.yml'
if (Test-Path $patchPath) {
    $needed = [regex]::Matches((Get-Content $patchPath -Raw), 'apiKeyEnv:\s*(\S+)') |
        ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique
} else {
    $needed = @('DEEPSEEK_API_KEY','OPENROUTER_API_KEY','CHEAPERINFERENCE_API_KEY','KILOCODE_API_KEY')
}

if (-not (Test-Path $credFile)) {
    Write-Warn "brak $credFile - dodaj klucze w GUI (Settings -> Models)"
} else {
    $raw = Get-Content $credFile -Raw
    foreach ($k in $needed) {
        if ($raw -match "(?m)^\s+$k\s*:") {
            Write-Ok "$k obecny"
        } else {
            Write-Warn "$k BRAK - dodaj go w GUI (Settings -> Models)"
        }
    }
}
Write-Info 'Klucze nigdy nie przechodza przez git. Ten skrypt ich nie zapisuje - naleza do seamu'

# ---------------------------------------------------------------------------
Write-Head '6. Machine-specific paths'
# ---------------------------------------------------------------------------

$pathsToCheck = @()
$bundleDirs = Get-ChildItem (Join-Path $Dest 'profile-bundles') -Directory -ErrorAction SilentlyContinue
foreach ($b in $bundleDirs) {
    $p = Join-Path $b.FullName 'cordis.patch.yml'
    if (-not (Test-Path $p)) { continue }
    $t = Get-Content $p -Raw

    # An absolute path in a bundle appears either as an MCP argument (- 'C:\...') or as an
    # environment value (NAME: 'C:\...'). The character class avoids escaping backslashes entirely:
    # requiring a doubled backslash matches nothing in a file that has single ones, which is exactly
    # how the first version of this check silently found one path out of seven.
    foreach ($m in [regex]::Matches($t, "(?:- |:\s*)'([A-Z]:[^']+)'")) {
        $pathsToCheck += [pscustomobject]@{ Bundle=$b.Name; Path=$m.Groups[1].Value }
    }
}

if ($pathsToCheck.Count -eq 0) {
    Write-Warn 'nie znalazlem zadnych absolutnych sciezke w bundle - sprawdz recznie'
} else {
    Write-Info "znaleziono $($pathsToCheck.Count) absolutnych sciezke"
    foreach ($p in $pathsToCheck) {
        if (Test-Path $p.Path) {
            Write-Ok ("{0,-10} {1}" -f $p.Bundle, $p.Path)
        } else {
            Write-Warn ("{0,-10} {1}  <- NIE ISTNIEJE" -f $p.Bundle, $p.Path)
            Write-Info 'popraw w profile-bundles, potem uruchom ten skrypt ponownie'
        }
    }
}

# ---------------------------------------------------------------------------
Write-Head '7. Verification'
# ---------------------------------------------------------------------------

if ($Check) {
    Write-Info 'tryb -Check: pomijam walidatory, bo profil nie zostal zsynchronizowany'
} else {
    $validate = Join-Path $Dest 'profile-bundles\validate.cjs'
    if (Test-Path $validate) {
        $out = node $validate 2>&1
        $out | ForEach-Object { Write-Info $_ }
        if ($LASTEXITCODE -eq 0) { Write-Ok 'walidator bundle: OK' } else { Write-Bad 'walidator bundle: BLAD' }
    } else {
        Write-Warn 'brak profile-bundles\validate.cjs'
    }

    $verify = Join-Path $Dest 'verify-presets.mjs'
    if (Test-Path $verify) {
        $out = node $verify 2>&1
        $out | Select-Object -Last 3 | ForEach-Object { Write-Info $_ }
        if ($LASTEXITCODE -eq 0) { Write-Ok 'weryfikacja presetow: OK' } else { Write-Bad 'weryfikacja presetow: BLAD' }
    }

    $rm = Join-Path $Dest 'check-readme.mjs'
    if (Test-Path $rm) {
        $out = node $rm 2>&1
        $out | Select-Object -Last 2 | ForEach-Object { Write-Info $_ }
        if ($LASTEXITCODE -eq 0) { Write-Ok 'README zgodny z repo: OK' } else { Write-Bad 'README niezgodny z repo' }
    }

    $refs = Join-Path $Dest 'check-references.mjs'
    if (Test-Path $refs) {
        $out = node $refs 2>&1
        $out | Select-Object -Last 2 | ForEach-Object { Write-Info $_ }
        if ($LASTEXITCODE -eq 0) { Write-Ok 'referencje skilli: OK' } else { Write-Bad 'referencje skilli: BLAD' }
    }
}

# ---------------------------------------------------------------------------
Write-Head 'Podsumowanie'
# ---------------------------------------------------------------------------

Write-Host "  bledy:   $script:Fails" -ForegroundColor $(if ($script:Fails) { 'Red' } else { 'Green' })
Write-Host "  ostrzezenia: $script:Warns" -ForegroundColor $(if ($script:Warns) { 'Yellow' } else { 'Green' })

if ($Check) {
    Write-Host ''
    Write-Host '  Tryb -Check: nic nie zmieniono.' -ForegroundColor Cyan
    Write-Host '  Uruchom bez -Check, aby wykonac calosc.' -ForegroundColor Cyan
} else {
    Write-Host ''
    Write-Host '  Nastepne kroki:' -ForegroundColor Cyan
    Write-Host '    1. dodaj brakujace klucze API w GUI (Settings -> Models)'
    Write-Host '    2. popraw sciezki oznaczone [warn] powyzej, jesli dotycza tej maszyny'
    Write-Host '    3. uruchom:  dsh web'
    Write-Host '    4. sprawdz, czy selektor presetow pokazuje 5 kart w sekcji Custom'
}

exit $(if ($script:Fails) { 1 } else { 0 })
