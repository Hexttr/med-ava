@echo off
chcp 65001 >nul
title EAM — med-ava

cd /d "%~dp0"

echo.
echo  Запуск приложения EAM (Next.js)...
echo  Откройте в браузере: http://localhost:3000
echo  Остановка: Ctrl+C
echo  При 404 на /api/analyze — закройте сервер и запустите start-legacy.bat
echo.

if not exist "node_modules" (
  echo  Папка node_modules не найдена. Выполняю npm install...
  call npm install
  echo.
)

REM Прокси VPN (v2ray): SOCKS5 10808 или HTTP 10809. Включите VPN до запуска.
if not defined EAM_HTTPS_PROXY set EAM_HTTPS_PROXY=socks5://127.0.0.1:10808

call npm run dev

pause
