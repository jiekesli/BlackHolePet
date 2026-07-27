$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$source = Join-Path $projectRoot 'native\GravityHelper.cs'
$manifest = Join-Path $projectRoot 'native\GravityHelper.manifest'
$output = Join-Path $projectRoot 'native\GravityHelper.exe'

if (-not (Test-Path -LiteralPath $compiler)) {
  throw "未找到 .NET Framework C# 编译器：$compiler"
}

& $compiler /nologo /optimize+ /target:winexe "/win32manifest:$manifest" "/out:$output" $source
if ($LASTEXITCODE -ne 0) {
  throw "GravityHelper 编译失败，退出码：$LASTEXITCODE"
}

Write-Host "已生成 $output"
