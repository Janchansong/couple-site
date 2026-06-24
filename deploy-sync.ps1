$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$workerDir = Join-Path $root "worker"
Set-Location $workerDir

Write-Host ""
Write-Host "============================================================"
Write-Host "  一键部署云同步（老婆只打开链接，你自动看到她的点菜）"
Write-Host "============================================================"
Write-Host ""

Write-Host "[1/4] 登录 Cloudflare（浏览器弹窗，免费）..."
npx wrangler login
if ($LASTEXITCODE -ne 0) { throw "Cloudflare 登录失败" }

Write-Host ""
Write-Host "[2/4] 创建云存储 KV..."
$kvOut = npx wrangler kv namespace create SYNC_KV 2>&1 | Out-String
if ($kvOut -match 'id\s*=\s*"([^"]+)"') {
  $kvId = $Matches[1]
} elseif ($kvOut -match "id = ([a-f0-9]+)") {
  $kvId = $Matches[1]
} else {
  throw "无法创建 KV，请手动运行: npx wrangler kv namespace create SYNC_KV"
}

$toml = Get-Content "wrangler.toml" -Raw -Encoding UTF8
$toml = $toml -replace "REPLACE_WITH_KV_ID", $kvId
Set-Content "wrangler.toml" $toml -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "[3/4] 部署云同步服务..."
$deployOut = npx wrangler deploy 2>&1 | Out-String
Write-Host $deployOut
if ($deployOut -match "(https://[a-z0-9-]+\.workers\.dev)") {
  $syncUrl = $Matches[1]
} else {
  throw "部署失败，未获取到 workers.dev 地址"
}

Write-Host ""
Write-Host "同步地址: $syncUrl"

Set-Location $root
$configPath = Join-Path $root "js\sync-config.js"
$config = Get-Content $configPath -Raw -Encoding UTF8
$config = $config -replace 'syncUrl:\s*""', "syncUrl: `"$syncUrl`""
Set-Content $configPath $config -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "[4/4] 推送到 GitHub..."
git add js/sync-config.js js/cloud-sync.js js/menu.js worker/wrangler.toml
git add -u *.html posts/*.html 2>$null
git commit -m "自动云同步：老婆打开链接即可点菜" 2>$null
git push origin master 2>$null
if ($LASTEXITCODE -ne 0) { git push origin main 2>$null }

Write-Host ""
Write-Host "============================================================"
Write-Host "  完成！发给老婆："
Write-Host "  https://janchansong.github.io/couple-site/menu.html"
Write-Host ""
Write-Host "  你打开同一链接 → 厨房清单，即可看到她点的菜。"
Write-Host "  她不需要做任何设置。"
Write-Host "============================================================"
Write-Host ""
Read-Host "按回车关闭"
