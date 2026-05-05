@echo off
title GSIA Construtora — Dev Server
cd /d "%~dp0"

echo.
echo  =========================================
echo   GSIA Construtora ^| Iniciando servidor...
echo  =========================================
echo.

:: Verifica se node_modules existe
if not exist "node_modules\" (
  echo  [!] node_modules nao encontrado. Instalando dependencias...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

:: Tenta npm direto
where npm >nul 2>&1
if errorlevel 1 (
  :: npm nao esta no PATH — tenta via npx no node_modules local
  echo  [!] npm nao encontrado no PATH. Tentando via node_modules...
  "node_modules\.bin\vite.cmd"
) else (
  npm run dev
)

pause
