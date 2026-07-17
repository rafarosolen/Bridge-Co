@echo off
title Quiz ao Vivo
cd /d %~dp0
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  ERRO: Node.js nao encontrado.
  echo  Baixe e instale em: https://nodejs.org  ^(versao LTS^)
  echo.
  pause
  exit /b 1
)
node server.js
pause
