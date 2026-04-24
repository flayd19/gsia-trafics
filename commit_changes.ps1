Set-Location "C:\Users\alife\Downloads\goianesia-flow-main"

# Remove lock se existir
if (Test-Path ".git\index.lock") {
    Remove-Item -Force ".git\index.lock"
    Write-Host "Lock removido." -ForegroundColor Yellow
}

# Stage e commit
git add src/hooks/useGlobalMarketplace.ts `
        src/components/screens/ComprarScreen.tsx `
        src/components/screens/FornecedoresCarrosScreen.tsx `
        src/pages/Index.tsx `
        src/data/cars.ts `
        SETUP_MARKETPLACE_GLOBAL.sql

git commit -m "fix: marketplace global online-only, error visibility, category labels, market values"
git push origin main

Write-Host "`nPronto! Deploy iniciado no Vercel." -ForegroundColor Green
Pause
