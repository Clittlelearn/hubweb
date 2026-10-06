[CmdletBinding()]
param(
    [switch]$Check,
    [switch]$NoRelay,
    [ValidateRange(1024, 65535)][int]$Port = 5174,
    [string]$Distro = 'wsl-mm',
    [string]$User = 'wbl'
)

$ErrorActionPreference = 'Stop'
$arguments = @('-d', $Distro, '-u', $User, '--', 'node', '/home/wbl/hubfrontend/tools/bridge-lab/start-environment.mjs', '--port', "$Port")
if ($Check) { $arguments += '--check' }
if ($NoRelay) { $arguments += '--no-relay' }
& wsl.exe @arguments
exit $LASTEXITCODE
