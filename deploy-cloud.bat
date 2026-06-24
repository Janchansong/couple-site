@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ============================================================
echo   我们俩 - 一键部署到云服务器（GitHub Pages，24小时在线）
echo ============================================================
echo.
echo 【重要】这不是在你公司电脑上跑网站！
echo   部署完成后，网站在 GitHub 的云服务器上，你关机、下班都没关系。
echo   老婆用手机流量随时能打开。
echo.
echo 需要：一个免费的 GitHub 账号（没有就去 github.com 注册）
echo.

where gh >nul 2>&1
if errorlevel 1 (
  echo 未找到 GitHub CLI，请先安装：winget install GitHub.cli
  pause
  exit /b 1
)

echo [1/4] 检查 GitHub 登录状态...
gh auth status >nul 2>&1
if errorlevel 1 (
  echo.
  echo 请在弹出的浏览器里登录 GitHub（只需做一次）
  echo.
  gh auth login --web --git-protocol https --hostname github.com
  if errorlevel 1 (
    echo 登录失败，请重试
    pause
    exit /b 1
  )
)

echo.
echo [2/4] 提交代码...
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "部署我们俩小站到 GitHub Pages"
) else (
  echo 没有新的改动需要提交，继续部署...
)

echo.
echo [3/4] 创建仓库并推送到 GitHub 云...
set /p REPO_NAME=请输入仓库名（直接回车默认 couple-site）: 
if "!REPO_NAME!"=="" set REPO_NAME=couple-site

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  gh repo create !REPO_NAME! --public --source=. --remote=origin --push
) else (
  git branch -M main 2>nul
  git push -u origin main 2>nul
  if errorlevel 1 git push -u origin master
)

echo.
echo [4/4] 开启 GitHub Pages（云托管）...
for /f "delims=" %%u in ('gh api user -q .login 2^>nul') do set GH_USER=%%u
if "!GH_USER!"=="" (
  echo 无法获取 GitHub 用户名，请手动到仓库 Settings - Pages 选 GitHub Actions
  pause
  exit /b 1
)

gh api -X PUT "repos/!GH_USER!/!REPO_NAME!/pages" -f build_type=workflow 2>nul

echo.
echo ============================================================
echo   部署已提交！几分钟后生效。
echo.
echo   你的网站地址：
echo   https://!GH_USER!.github.io/!REPO_NAME!/
echo.
echo   把上面链接发给老婆即可。你电脑可以关机。
echo.
echo   下一步：运行 deploy-sync.bat 部署云同步（点菜互通）
echo   或在「数据备份」页按说明配置家庭云同步。
echo ============================================================
echo.

start https://!GH_USER!.github.io/!REPO_NAME!/
start https://github.com/!GH_USER!/!REPO_NAME!/actions

pause
