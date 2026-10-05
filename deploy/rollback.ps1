<#
.SYNOPSIS
  Volta UM serviço para um commit anterior: checkout, npm ci, build, restart PM2 e healthcheck.

.DESCRIPTION
  - Sem -Commit, usa o commit anterior registrado em <Root>\.deploy-state\history.log.
  - O repositório fica em HEAD destacado; update-all.ps1 recusa atualizar até `git switch main`.
  - API: migrations são forward-only. Se o commit alvo não conhece uma migration já aplicada,
    a verificação de migrations falha e nada é reiniciado. Nesse caso siga a seção Rollback
    de docs/WINDOWS_SERVER_DEPLOY.md (API_READ_ONLY / restauração do pg_dump).

.EXAMPLE
  .\rollback.ps1 -Service site
.EXAMPLE
  .\rollback.ps1 -Service bot -Commit 0f9e569
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidateSet('api', 'site', 'bot')]
    [string]$Service,
    [string]$Commit,
    [string]$Root
)

. (Join-Path $PSScriptRoot 'common.ps1')
if (-not $Root) { $Root = Get-DefaultRoot }
foreach ($command in @('git', 'node', 'npm.cmd', 'pm2.cmd')) { Assert-Command $command }

$lock = Enter-DeployLock -Root $Root
$exitCode = 0
try {
    $target = Select-Services -Root $Root -Keys @($Service) | Select-Object -First 1
    Assert-ServiceFolder -Service $target

    if (-not $Commit) {
        $history = Join-Path (Get-StateDir -Root $Root) 'history.log'
        $line = if (Test-Path -LiteralPath $history) {
            [System.IO.File]::ReadAllLines($history) | Where-Object { $_ -match "^\S+ \S+ $Service " } | Select-Object -Last 1
        }
        if (-not $line -or $line -notmatch ' (\S+) -> \S+$' -or $Matches[1] -eq '(nenhum)') {
            throw 'Sem commit anterior no history.log. Informe -Commit <sha>.'
        }
        $Commit = $Matches[1]
    }

    $resolved = Get-NativeOutput -FilePath 'git' -Arguments @('rev-parse', '--verify', "$Commit^{commit}") -WorkingDirectory $target.Dir
    Write-Section "Rollback $($target.Name) -> $resolved"
    $dirty = Get-NativeOutput -FilePath 'git' -Arguments @('status', '--porcelain', '--untracked-files=no') -WorkingDirectory $target.Dir
    if ($dirty) { throw 'Há alterações locais em arquivos versionados. Resolva antes (git status).' }

    Invoke-Native -FilePath 'git' -Arguments @('checkout', '--detach', $resolved) -WorkingDirectory $target.Dir | Out-Null
    Invoke-ServiceDeploy -Service $target -Root $Root -SkipPull -Force -ForceInstall
    Invoke-Native -FilePath 'pm2.cmd' -Arguments @('save') | Out-Null
    Write-Section 'Rollback concluído'
    Write-Host "Para voltar à linha principal depois da correção: git -C `"$($target.Dir)`" switch main; .\update-all.ps1 -Services $Service"
} catch {
    Write-Fail $_.Exception.Message
    $exitCode = 1
} finally {
    $lock.Dispose()
}
exit $exitCode
