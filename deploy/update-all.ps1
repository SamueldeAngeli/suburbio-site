<#
.SYNOPSIS
  Atualização manual dos serviços Subúrbio na VPS (git pull, npm ci, build, PM2, healthcheck).

.DESCRIPTION
  Ordem: API -> Site -> Bot. Para no primeiro erro (pull, npm ci, build, verificação ou health).
  - Nunca aplica migrations: se houver migration pendente na API, aborta antes de parar qualquer coisa.
  - PM2 só é reiniciado após build bem-sucedido.
  - npm ci só roda quando package.json/package-lock.json mudaram desde o último deploy (ou com -ForceInstall).
  - Serviço já na versão atual e online é pulado (use -Force para refazer).
  Estado do último deploy por serviço: <Root>\.deploy-state\ (history.log guarda o histórico de commits).

.EXAMPLE
  .\update-all.ps1
.EXAMPLE
  .\update-all.ps1 -Services site
.EXAMPLE
  .\update-all.ps1 -Services api,bot -ForceInstall
#>
[CmdletBinding()]
param(
    [ValidateSet('api', 'site', 'bot')]
    [string[]]$Services = @('api', 'site', 'bot'),
    [string]$Root,
    [switch]$SkipPull,
    [switch]$Force,
    [switch]$ForceInstall,
    [switch]$SkipHealthcheck
)

. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $Root) { $Root = Get-DefaultRoot }

foreach ($command in @('git', 'node', 'npm.cmd', 'pm2.cmd')) { Assert-Command $command }

$lock = Enter-DeployLock -Root $Root
$logDir = Join-Path (Get-StateDir -Root $Root) 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$transcript = Join-Path $logDir ('update-{0:yyyyMMdd-HHmmss}.log' -f (Get-Date))
Start-Transcript -Path $transcript | Out-Null

$exitCode = 0
try {
    Write-Section "Subúrbio update  |  raiz: $Root  |  serviços: $($Services -join ', ')"
    $selected = Select-Services -Root $Root -Keys $Services
    foreach ($service in $selected) {
        Invoke-ServiceDeploy -Service $service -Root $Root -SkipPull:$SkipPull -Force:$Force -ForceInstall:$ForceInstall
    }

    Write-Step 'pm2 save (lista de processos para o boot)'
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('save') | Out-Null

    if (-not $SkipHealthcheck) {
        Write-Section 'Healthcheck final'
        $healthy = $true
        foreach ($service in (Get-SuburbioServices -Root $Root)) {
            if (Test-Path -LiteralPath (Join-Path $service.Dir '.git')) {
                if (-not (Test-ServiceHealth -Service $service -Retries 5 -DelaySeconds 3)) { $healthy = $false }
            }
        }
        if (-not $healthy) { throw 'Healthcheck final com falhas.' }
    }
    Write-Section 'Update concluído com sucesso'
} catch {
    Write-Fail $_.Exception.Message
    Write-Host "Log completo: $transcript"
    $exitCode = 1
} finally {
    Stop-Transcript | Out-Null
    $lock.Dispose()
}
exit $exitCode
