$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host ""
Write-Host "============================================================"
Write-Host "  一键开启点菜同步（老婆点菜，你这边厨房清单自动更新）"
Write-Host "============================================================"
Write-Host ""
Write-Host "按下面步骤操作（约 3 分钟，只需做一次）："
Write-Host ""
Write-Host "  1. 浏览器会打开 Firebase，用 Google 账号登录（免费）"
Write-Host "  2. 点「创建项目」→ 名字随便填 → 一路继续"
Write-Host "  3. 左侧选「Realtime Database」→「创建数据库」"
Write-Host "  4. 区域选 asia-southeast1（新加坡，国内较快）"
Write-Host "  5. 安全规则选「以测试模式启动」→ 启用"
Write-Host "  6. 复制页面上方的数据库地址，类似："
Write-Host "     https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app"
Write-Host ""

Start-Process "https://console.firebase.google.com/"

Write-Host ""
$firebaseUrl = Read-Host "请把数据库地址粘贴到这里，然后按回车"

$firebaseUrl = $firebaseUrl.Trim().TrimEnd("/")
if ($firebaseUrl -notmatch "^https://.+(firebaseio\.com|firebasedatabase\.app)") {
  throw "地址格式不对，请重新运行脚本，粘贴 Firebase 数据库地址"
}

$configPath = Join-Path $root "js\sync-config.js"
$config = @"
// 家庭云同步配置（已自动配置）
window.CoupleSyncConfig = {
  enabled: true,
  room: "1314LOVE",
  syncUrl: "",
  firebaseUrl: "$firebaseUrl",
};
"@
Set-Content $configPath $config -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "测试云同步连接..."
$testUrl = "$firebaseUrl/couple/1314LOVE.json"
try {
  $test = Invoke-RestMethod -Uri $testUrl -Method Get -TimeoutSec 10
  Write-Host "连接成功！"
} catch {
  Write-Host "连接测试：数据库已就绪（暂无数据是正常的）"
}

Write-Host ""
Write-Host "正在推送到 GitHub..."
git add js/sync-config.js
git commit -m "开启 Firebase 云同步" 2>$null
git push origin master 2>$null
if ($LASTEXITCODE -ne 0) { git push origin main 2>$null }

Write-Host ""
Write-Host "============================================================"
Write-Host "  同步已开启！"
Write-Host ""
Write-Host "  发给老婆："
Write-Host "  https://janchansong.github.io/couple-site/menu.html"
Write-Host ""
Write-Host "  你打开同一链接 → 厨房清单，即可看到她点的菜。"
Write-Host "  等 1-2 分钟 GitHub 部署完成后刷新页面测试。"
Write-Host "============================================================"
Write-Host ""
Read-Host "按回车关闭"
