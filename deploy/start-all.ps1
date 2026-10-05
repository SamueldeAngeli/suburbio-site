<#
.SYNOPSIS
  Garante que API, Site e Bot estejam rodando no PM2 (sem pull e sem build).

.DESCRIPTION
  Uso manual ou pela tarefa agendada de boot (-Boot).
  - Confere repositório, arquivo .env e artefato de build de cada serviço.
  - API: verifica migrations pendentes (somente leitura) e recusa iniciar se houver.
  - Serviço já online é mantido; parado/ausente é iniciado pelo ecosystem.config.cjs.
  - -Boot: espera PostgreSQL e Redis abrirem as portas e faz `pm2 resurrect`
    (restaura também processos extras salvos, como o LiveKit) antes de conferir os três serviços.
  Ao final: pm2 save e healthcheck.

.EXAMPLE
  .\start-all.ps1
.EXAMPLE
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\SUBURBIO\suburbio-site\deploy\start-all.ps1 -Boot
#>
[CmdletBinding()]
param(
    [ValidateSet('api', 'site', 'bot')]
    [string[]]$Services = @('api', 'site', 'bot'),
    [string]$Root,
    [switch]$Boot,
    [int]$DependencyTimeoutSeconds = 300
)

. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $Root) { $Root = Get-DefaultRoot }
foreach ($command in @('node', 'npm.cmd', 'pm2.cmd')) { Assert-Command $command }

$logDir = Join-Path (Get-StateDir -Root $Root) 'logs'
if (-not (Test-Path -LiteralPath $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$transcript = Join-Path $logDir ('start-{0:yyyyMMdd-HHmmss}.log' -f (Get-Date))
Start-Transcript -Path $transcript | Out-Null

$exitCode = 0
try {
    Assert-PortPlan -Root $Root
    $selected = Select-Services -Root $Root -Keys $Services
    $api =Get-SuburbioServices -Root $Root | Where-Object { $_.Key -eq 'api' }

    if ($Boot) {
        Write-Section 'Boot: aguardando PostgreSQL e Redis'
        $apiEnv = Read-DotEnv -Path (Join-Path $api.Dir $api.EnvFile)
        $pgHost = Get-EnvValue $apiEnv 'POSTGRES_HOST' '127.0.0.1'
        $pgPort = [int](Get-EnvValue $apiEnv 'POSTGRES_PORT' '5432')
        $redisUri = [Uri](Get-EnvValue $apiEnv 'REDIS_URL' 'redis://127.0.0.1:6379')
        foreach ($dependency in @(
                @{ Label = 'PostgreSQL'; HostName = $pgHost; Port = $pgPort },
                @{ Label = 'Redis'; HostName = $redisUri.Host; Port = $redisUri.Port })) {
            if (Wait-TcpPort -HostName $dependency.HostName -Port $dependency.Port -TimeoutSeconds $DependencyTimeoutSeconds) {
                Write-Ok "$($dependency.Label) aceitando conexões em $($dependency.HostName):$($dependency.Port)"
            } else {
                Write-Warn "$($dependency.Label) não respondeu em $DependencyTimeoutSeconds s; a API pode não ficar pronta."
            }
        }
        $anyOnline = @(Get-SuburbioServices -Root $Root | Where-Object { (Get-Pm2Pid -Name $_.Name) -gt 0 }).Count -gt 0
        if (-not $anyOnline) {
            Write-Step 'pm2 resurrect (restaura a lista salva por pm2 save)'
            Invoke-Native -FilePath 'pm2.cmd' -Arguments @('resurrect') -AllowedExitCodes @(0, 1) | Out-Null
        }
    }

    foreach ($service in $selected) {
        Write-Section "Start $($service.Name)"
        Assert-ServiceFolder -Service $service
        if (-not (Test-Path -LiteralPath (Join-Path $service.Dir $service.Artifact))) {
            throw "$($service.Name): build não encontrado ($($service.Artifact)). Rode deploy\update-all.ps1 -Services $($service.Key)."
        }
        if ((Get-Pm2Pid -Name $service.Name) -gt 0) {
            Write-Ok "$($service.Name) já está online"
            continue
        }
        if ($service.HasMigrations) { Assert-NoPendingMigrations -Service $service }
        $logs = Join-Path $service.Dir 'logs'
        if (-not (Test-Path -LiteralPath $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
        Start-Pm2Service -Service $service
        if (-not (Test-ServiceHealth -Service $service -Retries 20 -DelaySeconds 3)) {
            Write-Warn "$($service.Name) iniciou mas ainda não está pronto. Veja: pm2 logs $($service.Name) --lines 100"
            $exitCode = 1
        }
    }

    Write-Step 'pm2 save'
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('save') | Out-Null
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('ls') | Out-Null
} catch {
    Write-Fail $_.Exception.Message
    Write-Host "Log completo: $transcript"
    $exitCode = 1
} finally {
    Stop-Transcript | Out-Null
}
exit $exitCode
