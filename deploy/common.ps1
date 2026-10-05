# Funções compartilhadas pelos scripts de deploy (dot-source; não executar diretamente).
# Compatível com Windows PowerShell 5.1 e PowerShell 7.

Set-StrictMode -Version 3.0
$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12

# Raiz padrão: pasta que contém os três repositórios (ex.: D:\SUBURBIO).
function Get-DefaultRoot {
    Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
}

# Ordem importa: a API sobe antes do site e do bot.
function Get-SuburbioServices {
    param([Parameter(Mandatory)][string]$Root)
    @(
        [pscustomobject]@{
            Key = 'api'; Name = 'suburbio-api'; Dir = Join-Path $Root 'suburbio-api'
            EnvFile = '.env'; Artifact = 'dist\index.js'; HasMigrations = $true
            StopBeforeBuild = $false; VerifyScript = $null
        }
        [pscustomobject]@{
            Key = 'site'; Name = 'suburbio-site'; Dir = Join-Path $Root 'suburbio-site'
            EnvFile = '.env.production.local'; Artifact = '.next\BUILD_ID'; HasMigrations = $false
            # next build apaga e recria .next enquanto next start lê dele: parar antes de buildar.
            StopBeforeBuild = $true; VerifyScript = 'verify:client'
        }
        [pscustomobject]@{
            Key = 'bot'; Name = 'suburbio-bot'; Dir = Join-Path $Root 'suburbio-bot'
            EnvFile = '.env'; Artifact = 'dist\index.js'; HasMigrations = $false
            StopBeforeBuild = $false; VerifyScript = $null
        }
    )
}

function Select-Services {
    param([Parameter(Mandatory)][string]$Root, [string[]]$Keys)
    $all = Get-SuburbioServices -Root $Root
    if (-not $Keys -or $Keys.Count -eq 0) { return $all }
    @($all | Where-Object { $Keys -contains $_.Key })
}

function Write-Section {
    param([string]$Text)
    Write-Host ''
    Write-Host ('=' * 70) -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 70) -ForegroundColor Cyan
}

function Write-Step { param([string]$Text) Write-Host "-> $Text" -ForegroundColor Yellow }
function Write-Ok { param([string]$Text) Write-Host "[OK] $Text" -ForegroundColor Green }
function Write-Warn { param([string]$Text) Write-Host "[AVISO] $Text" -ForegroundColor DarkYellow }
function Write-Fail { param([string]$Text) Write-Host "[FALHA] $Text" -ForegroundColor Red }

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Comando '$Name' não encontrado no PATH desta sessão/conta."
    }
}

# Executa um programa externo mostrando a saída; lança exceção se o exit code não for permitido.
# PowerShell 5.1 não interrompe em exit code != 0 de executável nativo, por isso o teste explícito.
function Invoke-Native {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory,
        [int[]]$AllowedExitCodes = @(0)
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
    try {
        & $FilePath @Arguments | Out-Host
        $code = $LASTEXITCODE
    } finally {
        if ($WorkingDirectory) { Pop-Location }
        $ErrorActionPreference = $previous
    }
    if ($AllowedExitCodes -notcontains $code) {
        throw "Falhou (exit $code): $FilePath $($Arguments -join ' ')"
    }
    $code
}

# Executa e devolve o stdout (texto), sem exibir. Lança exceção se exit code != 0.
function Get-NativeOutput {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory
    )
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
    try {
        $out = & $FilePath @Arguments 2>$null
        $code = $LASTEXITCODE
    } finally {
        if ($WorkingDirectory) { Pop-Location }
        $ErrorActionPreference = $previous
    }
    if ($code -ne 0) { throw "Falhou (exit $code): $FilePath $($Arguments -join ' ')" }
    (@($out) -join "`n").Trim()
}

# Leitura simples de KEY=VALUE (ignora comentários). Valores nunca são exibidos.
function Read-DotEnv {
    param([Parameter(Mandatory)][string]$Path)
    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $values }
    foreach ($line in [System.IO.File]::ReadAllLines($Path)) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $index = $trimmed.IndexOf('=')
        if ($index -lt 1) { continue }
        $key = $trimmed.Substring(0, $index).Trim()
        $value = $trimmed.Substring($index + 1).Trim()
        if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $values[$key] = $value
    }
    $values
}

function Get-EnvValue {
    param([hashtable]$Values, [string]$Key, [string]$Default)
    if ($Values.ContainsKey($Key) -and $Values[$Key] -ne '') { return $Values[$Key] }
    $Default
}

# PID do processo no PM2 (0 = parado ou inexistente).
function Get-Pm2Pid {
    param([Parameter(Mandatory)][string]$Name)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try { $out = & pm2.cmd pid $Name 2>$null } finally { $ErrorActionPreference = $previous }
    $last = (@($out) | Where-Object { $_ -match '^\s*\d+\s*$' } | Select-Object -Last 1)
    if ($last) { return [int]$last.Trim() }
    0
}

function Stop-Pm2Service {
    param([Parameter(Mandatory)]$Service)
    if ((Get-Pm2Pid -Name $Service.Name) -gt 0) {
        Write-Step "pm2 stop $($Service.Name)"
        Invoke-Native -FilePath 'pm2.cmd' -Arguments @('stop', $Service.Name) | Out-Null
    }
}

# Remove a definição antiga e inicia pelo ecosystem.config.cjs do repositório,
# garantindo que mudanças no ecosystem (cwd, logs, env) sejam sempre aplicadas.
function Start-Pm2Service {
    param([Parameter(Mandatory)]$Service)
    Write-Step "pm2 (re)start $($Service.Name) via ecosystem.config.cjs"
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('delete', $Service.Name) -AllowedExitCodes @(0, 1) | Out-Null
    Assert-PortFree -Service $Service
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('start', 'ecosystem.config.cjs') -WorkingDirectory $Service.Dir | Out-Null
}

# Porta do site: fixa em ecosystem.config.cjs (`next start --port 3002`; o argumento vence PORT).
$script:SitePort = 3002
# Portas de infraestrutura na mesma VPS que nenhum serviço Node pode usar.
$script:ReservedPorts = @{
    80 = 'Caddy HTTP'; 443 = 'Caddy HTTPS'; 5432 = 'PostgreSQL'; 6379 = 'Redis'
    7880 = 'LiveKit sinalização'; 7881 = 'LiveKit RTC TCP'; 7882 = 'LiveKit RTC UDP'
    3478 = 'LiveKit TURN UDP'; 5349 = 'LiveKit TURN TLS'; 30120 = 'FiveM'
}

# Porta HTTP de cada serviço (0 = bot sem servidor de health).
function Get-ServicePort {
    param([Parameter(Mandatory)]$Service)
    $envValues = Read-DotEnv -Path (Join-Path $Service.Dir $Service.EnvFile)
    switch ($Service.Key) {
        'api' { return [int](Get-EnvValue $envValues 'PORT' '3000') }
        'site' { return $script:SitePort }
        'bot' { return [int](Get-EnvValue $envValues 'HEALTH_PORT' '0') }
    }
}

# Garante que API, site e bot usem portas distintas e fora das reservadas.
# Também remove PORT/HOST/HEALTH_PORT herdados da sessão: o PM2 repassa o ambiente do shell
# ao processo, e o dotenv não sobrescreve variável existente (o .env seria ignorado).
function Assert-PortPlan {
    param([Parameter(Mandatory)][string]$Root)
    foreach ($name in @('PORT', 'HOST', 'HEALTH_PORT')) {
        if (Test-Path -LiteralPath "Env:\$name") {
            Write-Warn "Variável $name definida no ambiente desta sessão/máquina; removida deste processo para não sobrepor os .env."
            Remove-Item -LiteralPath "Env:\$name"
        }
    }
    $used = @{}
    foreach ($service in (Get-SuburbioServices -Root $Root)) {
        if (-not (Test-Path -LiteralPath (Join-Path $service.Dir $service.EnvFile))) { continue }
        $port = Get-ServicePort -Service $service
        if ($port -eq 0) { continue }
        if ($script:ReservedPorts.ContainsKey($port)) {
            throw "$($service.Name) configurado na porta $port, reservada para $($script:ReservedPorts[$port])."
        }
        if ($used.ContainsKey($port)) {
            throw "Conflito de porta: $($service.Name) e $($used[$port]) configurados na porta $port. Padrão: API 3000, site 3002, bot 3101."
        }
        $used[$port] = $service.Name
    }
    Write-Ok ('Portas: ' + (($used.GetEnumerator() | Sort-Object Name | ForEach-Object { "$($_.Value)=$($_.Name)" }) -join ', '))
}

# Depois de remover o processo do PM2, a porta precisa estar livre; se outro programa a ocupa, falha com o PID.
function Assert-PortFree {
    param([Parameter(Mandatory)]$Service, [int]$TimeoutSeconds = 15)
    $port = Get-ServicePort -Service $Service
    if ($port -eq 0) { return }
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $listener) { return }
        Start-Sleep -Seconds 1
    } while ((Get-Date) -lt $deadline)
    $owner = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
    $label = if ($owner) { "$($owner.ProcessName) (PID $($owner.Id))" } else { "PID $($listener.OwningProcess)" }
    throw "$($Service.Name): porta $port ocupada por $label. Libere a porta ou ajuste o .env antes de iniciar."
}

# Endpoints reais (ver docs/OPERATIONS.md). Bot sem HEALTH_PORT fica sem probe.
function Get-HealthTargets {
    param([Parameter(Mandatory)]$Service)
    $port = Get-ServicePort -Service $Service
    switch ($Service.Key) {
        'api' {
            return @(
                [pscustomobject]@{ Label = 'API live'; Url = "http://127.0.0.1:$port/live" }
                [pscustomobject]@{ Label = 'API ready'; Url = "http://127.0.0.1:$port/ready" }
            )
        }
        'site' {
            return @(
                [pscustomobject]@{ Label = 'Site health'; Url = "http://127.0.0.1:$port/api/health" }
                [pscustomobject]@{ Label = 'Site ready'; Url = "http://127.0.0.1:$port/api/ready" }
            )
        }
        'bot' {
            if ($port -eq 0) { return @() }
            return @(
                [pscustomobject]@{ Label = 'Bot health'; Url = "http://127.0.0.1:$port/health" }
                [pscustomobject]@{ Label = 'Bot ready'; Url = "http://127.0.0.1:$port/ready" }
            )
        }
    }
}

function Invoke-HttpProbe {
    param([Parameter(Mandatory)][string]$Url, [int]$TimeoutSec = 5)
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec -MaximumRedirection 0
        return [pscustomobject]@{ Status = [int]$response.StatusCode; Body = [string]$response.Content }
    } catch {
        $status = 0
        if ($_.Exception.PSObject.Properties['Response'] -and $_.Exception.Response) {
            $status = [int]$_.Exception.Response.StatusCode
        }
        $body = if ($_.ErrorDetails) { $_.ErrorDetails.Message } else { $_.Exception.Message }
        return [pscustomobject]@{ Status = $status; Body = [string]$body }
    }
}

# Tenta até obter 200. Devolve o último resultado.
function Wait-HttpOk {
    param([Parameter(Mandatory)][string]$Url, [int]$Retries = 1, [int]$DelaySeconds = 3)
    $result = $null
    for ($i = 1; $i -le [Math]::Max(1, $Retries); $i++) {
        $result = Invoke-HttpProbe -Url $Url
        if ($result.Status -eq 200) { return $result }
        if ($i -lt $Retries) { Start-Sleep -Seconds $DelaySeconds }
    }
    $result
}

function Test-ServiceHealth {
    param([Parameter(Mandatory)]$Service, [int]$Retries = 1, [int]$DelaySeconds = 3)
    $ok = $true
    $targets = @(Get-HealthTargets -Service $Service)
    if ($targets.Count -eq 0) {
        Write-Warn "$($Service.Name): HEALTH_PORT=0 no .env; sem probe HTTP (defina HEALTH_PORT=3101)."
        return $true
    }
    foreach ($target in $targets) {
        $result = Wait-HttpOk -Url $target.Url -Retries $Retries -DelaySeconds $DelaySeconds
        $body = $result.Body
        if ($body.Length -gt 300) { $body = $body.Substring(0, 300) + '...' }
        if ($result.Status -eq 200) {
            Write-Ok "$($target.Label) $($target.Url) -> 200 $body"
        } else {
            Write-Fail "$($target.Label) $($target.Url) -> $($result.Status) $body"
            $ok = $false
        }
    }
    $ok
}

function Wait-TcpPort {
    param([string]$HostName = '127.0.0.1', [int]$Port, [int]$TimeoutSeconds = 180)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $client = New-Object System.Net.Sockets.TcpClient
        try {
            $task = $client.ConnectAsync($HostName, $Port)
            if ($task.Wait(2000) -and $client.Connected) { return $true }
        } catch {
            # porta ainda fechada
        } finally {
            $client.Dispose()
        }
        Start-Sleep -Seconds 3
    }
    $false
}

# Verifica migrations pendentes SEM aplicar (npm run db:check: 0 = nenhuma, 3 = pendente).
function Assert-NoPendingMigrations {
    param([Parameter(Mandatory)]$Service)
    Write-Step "Verificando migrations pendentes (somente leitura)"
    $code = Invoke-Native -FilePath 'npm.cmd' -Arguments @('run', '--silent', 'db:check') -WorkingDirectory $Service.Dir -AllowedExitCodes @(0, 1, 2, 3)
    if ($code -eq 3) {
        throw ("Há migrations pendentes na API. Nada foi reiniciado por este passo. Faça backup (pg_dump), " +
            "aplique manualmente conforme docs/WINDOWS_SERVER_DEPLOY.md (seção Banco/migrations) e rode o script de novo.")
    }
    if ($code -ne 0) {
        throw "Não foi possível verificar migrations (exit $code). Confira PostgreSQL, Redis e o .env da API."
    }
    Write-Ok 'Nenhuma migration pendente'
}

function Get-StateDir {
    param([Parameter(Mandatory)][string]$Root)
    $dir = Join-Path $Root '.deploy-state'
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
    $dir
}

function Get-DeployedCommit {
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)]$Service)
    $file = Join-Path (Get-StateDir -Root $Root) "$($Service.Key).commit"
    if (Test-Path -LiteralPath $file) { return ([System.IO.File]::ReadAllText($file)).Trim() }
    ''
}

function Set-DeployedCommit {
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)]$Service, [Parameter(Mandatory)][string]$Commit, [string]$Previous)
    $dir = Get-StateDir -Root $Root
    [System.IO.File]::WriteAllText((Join-Path $dir "$($Service.Key).commit"), $Commit, $utf8)
    $line = '{0:yyyy-MM-dd HH:mm:ss} {1} {2} -> {3}' -f (Get-Date), $Service.Key, $(if ($Previous) { $Previous } else { '(nenhum)' }), $Commit
    [System.IO.File]::AppendAllText((Join-Path $dir 'history.log'), $line + [Environment]::NewLine, $utf8)
}

# Impede duas execuções simultâneas de deploy. O lock é liberado quando o processo termina.
function Enter-DeployLock {
    param([Parameter(Mandatory)][string]$Root)
    $path = Join-Path (Get-StateDir -Root $Root) 'deploy.lock'
    try {
        return [System.IO.File]::Open($path, 'OpenOrCreate', 'ReadWrite', 'None')
    } catch {
        throw 'Outro deploy/update está em execução (deploy.lock em uso).'
    }
}

function Assert-ServiceFolder {
    param([Parameter(Mandatory)]$Service)
    if (-not (Test-Path -LiteralPath (Join-Path $Service.Dir '.git'))) {
        throw "$($Service.Name): repositório não encontrado em $($Service.Dir)."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $Service.Dir $Service.EnvFile))) {
        throw "$($Service.Name): crie $($Service.EnvFile) a partir de .env.example antes de continuar."
    }
}

# Pipeline completo de um serviço: pull, instalação, build, verificação, restart e health.
# Nunca aplica migrations. PM2 só é reiniciado após build bem-sucedido.
function Invoke-ServiceDeploy {
    param(
        [Parameter(Mandatory)]$Service,
        [Parameter(Mandatory)][string]$Root,
        [switch]$SkipPull,
        [switch]$Force,
        [switch]$ForceInstall,
        [int]$HealthRetries = 20
    )
    Write-Section "Atualizando $($Service.Name)  ($($Service.Dir))"
    Assert-ServiceFolder -Service $Service
    $dir = $Service.Dir

    $dirty = Get-NativeOutput -FilePath 'git' -Arguments @('status', '--porcelain', '--untracked-files=no') -WorkingDirectory $dir
    if ($dirty) { throw "$($Service.Name): há alterações locais em arquivos versionados. Resolva antes (git status)." }

    if (-not $SkipPull) {
        $branch = Get-NativeOutput -FilePath 'git' -Arguments @('rev-parse', '--abbrev-ref', 'HEAD') -WorkingDirectory $dir
        if ($branch -eq 'HEAD') {
            throw "$($Service.Name): HEAD destacado (rollback ativo?). Volte com 'git switch main' antes de atualizar."
        }
        Write-Step "git pull --ff-only ($branch)"
        Invoke-Native -FilePath 'git' -Arguments @('pull', '--ff-only') -WorkingDirectory $dir | Out-Null
    }

    $head = Get-NativeOutput -FilePath 'git' -Arguments @('rev-parse', 'HEAD') -WorkingDirectory $dir
    $deployed = Get-DeployedCommit -Root $Root -Service $Service
    $online = (Get-Pm2Pid -Name $Service.Name) -gt 0
    Write-Host "   commit atual: $head"
    Write-Host "   último deploy: $(if ($deployed) { $deployed } else { '(nenhum)' })"

    if (-not $Force -and $head -eq $deployed -and $online) {
        Write-Ok "$($Service.Name) já está nesta versão e online. Nada a fazer (use -Force para refazer)."
        return
    }

    $hasModules = Test-Path -LiteralPath (Join-Path $dir 'node_modules')
    $depsChanged = $ForceInstall -or -not $hasModules -or -not $deployed
    if (-not $depsChanged) {
        try {
            $changed = Get-NativeOutput -FilePath 'git' -Arguments @('diff', '--name-only', $deployed, $head, '--', 'package.json', 'package-lock.json') -WorkingDirectory $dir
            $depsChanged = [bool]$changed
        } catch {
            # Commit do último deploy não existe mais no histórico local: reinstalar por segurança.
            $depsChanged = $true
        }
    }

    # Checagem antecipada: com migration pendente, nada é parado nem instalado.
    if ($Service.HasMigrations -and $hasModules) { Assert-NoPendingMigrations -Service $Service }

    # Windows trava arquivos em uso (.node nativos, .next): parar antes de trocar.
    if ($depsChanged -or $Service.StopBeforeBuild) { Stop-Pm2Service -Service $Service }

    try {
        if ($depsChanged) {
            # --include=dev: o build precisa de TypeScript/tsx mesmo se NODE_ENV=production estiver no ambiente.
            Write-Step 'npm ci --include=dev'
            Invoke-Native -FilePath 'npm.cmd' -Arguments @('ci', '--include=dev', '--no-audit', '--no-fund') -WorkingDirectory $dir | Out-Null
        } else {
            Write-Ok 'Dependências inalteradas desde o último deploy (npm ci pulado; use -ForceInstall para forçar)'
        }

        Write-Step 'npm run build'
        Invoke-Native -FilePath 'npm.cmd' -Arguments @('run', 'build') -WorkingDirectory $dir | Out-Null

        if ($Service.VerifyScript) {
            Write-Step "npm run $($Service.VerifyScript)"
            Invoke-Native -FilePath 'npm.cmd' -Arguments @('run', $Service.VerifyScript) -WorkingDirectory $dir | Out-Null
        }

        if ($Service.HasMigrations) { Assert-NoPendingMigrations -Service $Service }
    } catch {
        if ((Get-Pm2Pid -Name $Service.Name) -gt 0) {
            Write-Fail "$($Service.Name) continua rodando a versão anterior em memória; o código em disco mudou. Não reinicie antes de corrigir."
        } else {
            Write-Fail "$($Service.Name) está PARADO. Corrija e rode de novo, ou faça rollback (deploy\rollback.ps1)."
        }
        throw
    }

    $logs = Join-Path $dir 'logs'
    if (-not (Test-Path -LiteralPath $logs)) { New-Item -ItemType Directory -Path $logs | Out-Null }
    Start-Pm2Service -Service $Service

    Write-Step 'Aguardando health/ready'
    if (-not (Test-ServiceHealth -Service $Service -Retries $HealthRetries -DelaySeconds 3)) {
        throw "$($Service.Name) iniciou mas não ficou pronto. Veja: pm2 logs $($Service.Name) --lines 100"
    }
    Set-DeployedCommit -Root $Root -Service $Service -Commit $head -Previous $deployed
    Write-Ok "$($Service.Name) atualizado para $head"
}
