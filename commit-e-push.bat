@echo off
cd /d "C:\Users\alife\Downloads\goianesia-flow-main"
echo Removendo locks...
del /f /q ".git\index.lock" 2>nul
del /f /q ".git\HEAD.lock" 2>nul
del /f /q ".git\COMMIT_EDITMSG.lock" 2>nul
echo Adicionando arquivos...
git add -A
echo Commitando...
git commit -m "refactor: limpeza completa — remove telas/hooks/dados do jogo antigo, adapta Settings e Ranking para jogo de carros"
echo Fazendo push...
git push
echo.
echo === CONCLUIDO ===
pause
