param (
    [switch]$Recriar
)

$ContainerName = "claude-sandbox"

if ($Recriar) {
    Write-Host "Destruindo o sandbox antigo para recriar do zero..." -ForegroundColor Yellow
    podman rm -f $ContainerName | Out-Null
}

$containerExists = podman ps -a -q -f name=$ContainerName

if (-not $containerExists) {
    Write-Host "Criando e iniciando o sandbox..." -ForegroundColor Cyan
    podman run -d `
      --name $ContainerName `
      --network="9roouter_default" `
      -v "${PWD}:/app" `
      -w /app `
      ubuntu-claude-sandbox | Out-Null
} else {
    $isRunning = podman ps -q -f name=$ContainerName
    if (-not $isRunning) {
        Write-Host "Iniciando o container parado..." -ForegroundColor Cyan
        podman start $ContainerName | Out-Null
    }
}

Write-Host "Iniciando o Claude Code..." -ForegroundColor Green
# As variáveis são injetadas DIRETAMENTE na sessão do Claude Code agora:
  podman exec -it -e ANTHROPIC_BASE_URL="http://9router:20128/v1" `
    -e ANTHROPIC_API_KEY="sk-19df0398869548d6-5cvgnf-67b2e296" `
    -e ANTHROPIC_MODEL="all-in-one" `
    -e CLAUDE_CODE_SIMPLE=0 `
    $ContainerName `
    npx -y @anthropic-ai/claude-code --permission-mode auto