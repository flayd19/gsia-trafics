@echo off
chcp 65001 >nul
setlocal

REM ============================================================
REM  Push dos commits pendentes pro GitHub
REM  Projeto: gsia-trafics  (flayd19/gsia-trafics)
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   GSIA TRAFICS - Push para GitHub
echo ============================================================
echo.

echo [1/4] Verificando branch atual...
git rev-parse --abbrev-ref HEAD
if errorlevel 1 (
    echo.
    echo ERRO: nao foi possivel rodar git. Voce esta na pasta certa?
    echo Pasta atual: %cd%
    pause
    exit /b 1
)
echo.

echo [2/4] Commits locais que serao enviados:
echo ------------------------------------------------------------
git log origin/main..HEAD --oneline
echo ------------------------------------------------------------
echo.

echo [3/4] Enviando para origin/main...
echo.
git push origin main
if errorlevel 1 (
    echo.
    echo ============================================================
    echo   ERRO NO PUSH
    echo ============================================================
    echo.
    echo Possiveis causas:
    echo.
    echo   1. Voce precisa estar logado no GitHub.
    echo      Rode no terminal:
    echo          gh auth login
    echo      ou configure um Personal Access Token.
    echo.
    echo   2. O remote pode estar com credenciais vencidas.
    echo      Tente:
    echo          git remote -v
    echo      e confirme que aponta para github.com/flayd19/gsia-trafics.git
    echo.
    echo   3. Conflito com alteracoes remotas.
    echo      Tente:
    echo          git pull --rebase origin main
    echo          git push origin main
    echo.
    pause
    exit /b 1
)

echo.
echo [4/4] Push concluido com sucesso!
echo.
echo ============================================================
echo   PRONTO
echo ============================================================
echo.
echo O Vercel vai detectar o novo commit em ~15s e comecar um
echo deploy automatico. Voce pode acompanhar em:
echo.
echo   https://vercel.com/flayd19s-projects/gsia-trafics
echo.
echo Quando o deploy ficar "Ready" (verde), abra uma aba anonima
echo em https://gsia-trafics.vercel.app e teste o cadastro.
echo.
echo ============================================================
echo.
pause
endlocal
