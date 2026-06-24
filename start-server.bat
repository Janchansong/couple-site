@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动网站服务器...
python server.py
pause
