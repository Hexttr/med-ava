@echo off
chcp 65001 >nul
title EAM — med-ava (очистка кэша)

cd /d "%~dp0"

echo.
echo  Удаление кэша .next и запуск (если был 404 на /api/analyze)...
if exist ".next" rd /s /q ".next"
echo  http://localhost:3000
echo.

if not exist "node_modules" (
  call npm install
  echo.
)

call npm run dev
pause
