@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo   我们俩 - Netlify 公网部署（拖拽上传）
echo ========================================
echo.

set "ZIP=deploy-site.zip"
if exist "%ZIP%" del "%ZIP%"

echo 正在打包网站文件...
powershell -NoProfile -Command ^
  "$root = Get-Location; " ^
  "$items = Get-ChildItem -Force | Where-Object { $_.Name -notin @('.git','deploy-site.zip','node_modules','.wrangler') }; " ^
  "Compress-Archive -Path $items.FullName -DestinationPath 'deploy-site.zip' -Force"

if not exist "%ZIP%" (
  echo 打包失败，请检查 PowerShell 是否可用。
  pause
  exit /b 1
)

echo.
echo 打包完成：%ZIP%
echo 正在打开 Netlify 拖拽上传页面...
echo 把 deploy-site.zip 拖进网页即可获得公网链接（如 xxx.netlify.app）
echo.

start https://app.netlify.com/drop

echo 完成后把链接发给老婆，并在「数据备份」页配置家庭云同步。
echo.
pause
