@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo   我们俩 - GitHub Pages 公网部署
echo ========================================
echo.
echo 步骤 1：在浏览器打开 https://github.com/new
echo        新建仓库，名称例如 couple-site（不要勾选 README）
echo.
echo 步骤 2：把下面命令里的 YOUR_NAME 换成你的 GitHub 用户名后执行：
echo.
echo   git add -A
echo   git commit -m "上线我们俩小站"
echo   git branch -M main
echo   git remote add origin https://github.com/YOUR_NAME/couple-site.git
echo   git push -u origin main
echo.
echo 步骤 3：GitHub 仓库 - Settings - Pages
echo        Build and deployment - Source 选 GitHub Actions
echo        推送后会自动部署，地址为：
echo        https://YOUR_NAME.github.io/couple-site/
echo.
echo 步骤 4：在「数据备份」页配置家庭云同步，把链接发给老婆
echo.

start https://github.com/new

pause
