<#
.SYNOPSIS
  Valida os serviços Subúrbio: processo no PM2 e endpoints health/ready reais.

.DESCRIPTION
  Local (loopback, sempre):
    API   GET /live, GET /ready            (porta = PORT do .env da API, padrão 3000)
    Site  GET /api/health, GET /api/ready  (127.0.0.1:3002)
    Bot   GET /health, GET /ready          (HEALTH_PORT do .env do bot; 0 = sem probe)
  Público (opcional, via Caddy/HTTPS): -PublicSiteUrl e -PublicApiUrl.
  Sai com código 1 se algo falhar.

.EXAMPLE
  .\healthcheck.ps1
.EXAMPLE
  .\healthcheck.ps1 -PublicSiteUrl https://suburbioroleplay.com -PublicApiUrl https://api.suburbioroleplay.com
#>
[CmdletBinding()]
param(
    [ValidateSet('api', 'site', 'bot')]
    [string[]]$Services = @('api', 'site', 'bot'),
    [string]$Root,
    [int]$Retries = 1,
    [int]$DelaySeconds = 3,
    [string]$PublicSiteUrl,
    [string]$PublicApiUrl
)

. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $Root) { $Root = Get-DefaultRoot }

$healthy = $true
$hasPm2 = [bool](Get-Command 'pm2.cmd' -ErrorAction SilentlyContinue)
if (-not $hasPm2) { Write-Warn 'pm2 não encontrado no PATH: status de processo não será verificado.' }

foreach ($service in (Select-Services -Root $Root -Keys $Services)) {
    Write-Section $service.Name
    if (-not (Test-Path -LiteralPath (Join-Path $service.Dir '.git'))) {
        Write-Fail "Repositório não encontrado em $($service.Dir)"
        $healthy = $false
        continue
    }
    if ($hasPm2) {
        $processId = Get-Pm2Pid -Name $service.Name
        if ($processId -gt 0) { Write-Ok "PM2: online (pid $processId)" } else { Write-Fail 'PM2: parado ou não registrado'; $healthy = $false }
    }
    if (-not (Test-ServiceHealth -Service $service -Retries $Retries -DelaySeconds $DelaySeconds)) { $healthy = $false }
}

$public = @()
if ($PublicSiteUrl) {
    $base = $PublicSiteUrl.TrimEnd('/')
    $public += [pscustomobject]@{ Label = 'Site público health'; Url = "$base/api/health" }
    $public += [pscustomobject]@{ Label = 'Site público ready'; Url = "$base/api/ready" }
}
if ($PublicApiUrl) {
    $base = $PublicApiUrl.TrimEnd('/')
    $public += [pscustomobject]@{ Label = 'API pública live'; Url = "$base/live" }
    $public += [pscustomobject]@{ Label = 'API pública ready'; Url = "$base/ready" }
}
if ($public.Count -gt 0) {
    Write-Section 'Endpoints públicos (Caddy/HTTPS)'
    foreach ($target in $public) {
        $result = Wait-HttpOk -Url $target.Url -Retries $Retries -DelaySeconds $DelaySeconds
        if ($result.Status -eq 200) { Write-Ok "$($target.Label) $($target.Url) -> 200" }
        else { Write-Fail "$($target.Label) $($target.Url) -> $($result.Status)"; $healthy = $false }
    }
    if ($PublicApiUrl) {
        # O proxy deve bloquear /internal/* (404). Qualquer outra resposta indica exposição indevida.
        $probe = Invoke-HttpProbe -Url "$($PublicApiUrl.TrimEnd('/'))/internal/health"
        if ($probe.Status -eq 404) { Write-Ok 'API pública: /internal/* bloqueado pelo proxy (404)' }
        else { Write-Fail "API pública: /internal/health respondeu $($probe.Status); o Caddy deveria responder 404"; $healthy = $false }
    }
}

Write-Host ''
if ($healthy) { Write-Ok 'Todos os checks passaram.'; exit 0 }
Write-Fail 'Há checks com falha.'
exit 1
