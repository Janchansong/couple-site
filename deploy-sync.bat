@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0worker"

echo.
echo ========================================
echo   我们俩 - 云同步服务部署（Cloudflare）
echo ========================================
echo.
echo 首次使用请先运行：npx wrangler login
echo.
echo 创建 KV 命名空间（只需一次）：
echo   npx wrangler kv namespace create SYNC_KV
echo 把返回的 id 填进 worker\wrangler.toml 里的 REPLACE_WITH_KV_ID
echo.
echo 按任意键开始部署同步服务...
pause >nul

call npx wrangler deploy

echo.
echo 部署成功后，把显示的 workers.dev 地址填到网站「数据备份」-「同步服务器地址」
echo.
pause
