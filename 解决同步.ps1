$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "============================================================"
Write-Host "  解决点菜同步（老婆点菜 → 你厨房清单自动更新）"
Write-Host "============================================================"
Write-Host ""

# 检查是否已配置
$cfg = Get-Content "js\sync-config.js" -Raw -Encoding UTF8
if ($cfg -match 'syncUrl:\s*"https://[^"]+"' -or $cfg -match 'firebaseUrl:\s*"https://[^"]+"') {
  Write-Host "检测到同步可能已配置。若仍不同步，请继续完成 Cloudflare 部署。"
  Write-Host ""
}

Write-Host "【方式 A】Cloudflare 云同步（推荐，GitHub 自动部署）"
Write-Host ""
Write-Host "步骤 1：注册 Cloudflare（免费）"
Write-Host "  https://dash.cloudflare.com/sign-up"
Write-Host ""
Write-Host "步骤 2：创建 API 令牌"
Write-Host "  打开 https://dash.cloudflare.com/profile/api-tokens"
Write-Host "  → 创建令牌 → 使用模板「编辑 Cloudflare Workers」→ 继续 → 创建"
Write-Host "  → 复制生成的令牌（只显示一次）"
Write-Host ""
Write-Host "步骤 3：复制 Account ID"
Write-Host "  打开 https://dash.cloudflare.com/ 首页右侧可以看到 Account ID"
Write-Host ""

Start-Process "https://dash.cloudflare.com/profile/api-tokens"
Start-Sleep -Seconds 2
Start-Process "https://dash.cloudflare.com/"

Write-Host ""
$token = Read-Host "请粘贴 Cloudflare API 令牌"
$accountId = Read-Host "请粘贴 Account ID"

if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($accountId)) {
  throw "令牌和 Account ID 都不能为空"
}

Write-Host ""
Write-Host "正在保存到 GitHub 密钥..."
gh secret set CLOUDFLARE_API_TOKEN --body $token
gh secret set CLOUDFLARE_ACCOUNT_ID --body $accountId

Write-Host ""
Write-Host "正在触发云同步部署（约 1-2 分钟）..."
gh workflow run "Deploy Cloud Sync Worker" --repo Janchansong/couple-site

Write-Host "等待部署完成..."
Start-Sleep -Seconds 15
$runId = (gh run list --workflow="Deploy Cloud Sync Worker" --limit 1 --json databaseId -q ".[0].databaseId")
if ($runId) {
  gh run watch $runId --exit-status 2>$null
}

Write-Host ""
Write-Host "============================================================"
Write-Host "  部署完成！"
Write-Host ""
Write-Host "  1. 等 1-2 分钟 GitHub Pages 更新"
Write-Host "  2. 老婆手机打开："
Write-Host "     https://janchansong.github.io/couple-site/menu.html"
Write-Host "  3. 你打开同一链接 → 厨房清单"
Write-Host "  4. 她点一道菜，你刷新厨房清单应能看到"
Write-Host ""
Write-Host "  若失败，可用方式 B：双击「一键开启同步.bat」走 Firebase"
Write-Host "============================================================"
Write-Host ""
Read-Host "按回车关闭"
