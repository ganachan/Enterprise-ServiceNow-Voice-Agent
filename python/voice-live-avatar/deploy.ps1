#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Deploy Voice Live Avatar app to Azure Container Apps.

.DESCRIPTION
    Builds the Docker image via ACR cloud build (no local Docker required),
    provisions a Container App environment, and deploys the app with all required
    environment variables. Cosmos DB access uses a system-assigned managed identity.

.USAGE
    cd voicelive-samples/python/voice-live-avatar
    ./deploy.ps1

.NOTES
    Prerequisites: az CLI logged in  (run `az login` first)
                   az extensions: containerapp, acr  (auto-installed below)
#>

# ──────────────────────────────────────────────
# CONFIGURATION  — edit these before running
# ──────────────────────────────────────────────
$RESOURCE_GROUP      = "rg-itsm-voice-agent"
$LOCATION            = "eastus2"           # Change if needed
$ACR_NAME            = "itsmvoiceacr"      # Must be globally unique, lowercase, 5-50 chars
$APP_NAME            = "itsm-voice-agent"
$ENV_NAME            = "itsm-voice-env"
$IMAGE_TAG           = "latest"

# App environment variables (matched from your .env)
$VOICELIVE_ENDPOINT  = "https://agents-foundry-eastus2.services.ai.azure.com/"
$VOICELIVE_MODEL     = "gpt-4o-realtime"
$VOICELIVE_VOICE     = "en-US-AvaMultilingualNeural"
$COSMOS_ENDPOINT     = "https://agentsservicenowcosmosdb.documents.azure.com:443/"
$COSMOS_DATABASE     = "voice-live-avatar"
$COSMOS_CONTAINER    = "conversations"

# Secret: API key (stored as a Container App secret — never in image or plain env)
# Set this value from your environment or Azure Key Vault — do NOT hardcode here
$VOICELIVE_API_KEY   = $env:VOICELIVE_API_KEY

# ──────────────────────────────────────────────
# SCRIPT BODY
# ──────────────────────────────────────────────
$ErrorActionPreference = "Stop"
$IMAGE_NAME = "${ACR_NAME}.azurecr.io/${APP_NAME}:${IMAGE_TAG}"

Write-Host "`n=== 1/7  Ensuring required az extensions ===" -ForegroundColor Cyan
az extension add --name containerapp --upgrade --only-show-errors
az extension add --name acr           --upgrade --only-show-errors

Write-Host "`n=== 2/7  Creating resource group: $RESOURCE_GROUP ===" -ForegroundColor Cyan
az group create --name $RESOURCE_GROUP --location $LOCATION --output table

Write-Host "`n=== 3/7  Creating Azure Container Registry: $ACR_NAME ===" -ForegroundColor Cyan
az acr create `
    --resource-group $RESOURCE_GROUP `
    --name $ACR_NAME `
    --sku Basic `
    --admin-enabled false `
    --output table

Write-Host "`n=== 4/7  Building image via ACR cloud build (no local Docker needed) ===" -ForegroundColor Cyan
az acr build `
    --registry $ACR_NAME `
    --image "${APP_NAME}:${IMAGE_TAG}" `
    --file Dockerfile `
    .

Write-Host "`n=== 5/7  Creating Container App environment: $ENV_NAME ===" -ForegroundColor Cyan
az containerapp env create `
    --name $ENV_NAME `
    --resource-group $RESOURCE_GROUP `
    --location $LOCATION `
    --output table

Write-Host "`n=== 6/7  Deploying Container App: $APP_NAME ===" -ForegroundColor Cyan

# Get ACR login server
$ACR_LOGIN_SERVER = az acr show --name $ACR_NAME --query loginServer --output tsv

az containerapp create `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --environment $ENV_NAME `
    --image "${ACR_LOGIN_SERVER}/${APP_NAME}:${IMAGE_TAG}" `
    --registry-server $ACR_LOGIN_SERVER `
    --registry-identity system `
    --target-port 3000 `
    --ingress external `
    --min-replicas 1 `
    --max-replicas 3 `
    --cpu 1.0 `
    --memory 2.0Gi `
    --system-assigned `
    --secrets "voicelive-api-key=${VOICELIVE_API_KEY}" `
    --env-vars `
        "AZURE_VOICELIVE_ENDPOINT=${VOICELIVE_ENDPOINT}" `
        "AZURE_VOICELIVE_API_KEY=secretref:voicelive-api-key" `
        "VOICELIVE_MODEL=${VOICELIVE_MODEL}" `
        "VOICELIVE_VOICE=${VOICELIVE_VOICE}" `
        "COSMOS_ENDPOINT=${COSMOS_ENDPOINT}" `
        "COSMOS_DATABASE=${COSMOS_DATABASE}" `
        "COSMOS_CONTAINER=${COSMOS_CONTAINER}" `
    --output table

Write-Host "`n=== 7/7  Granting AcrPull role to Container App managed identity ===" -ForegroundColor Cyan
$APP_PRINCIPAL_ID = az containerapp show `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --query identity.principalId `
    --output tsv

$ACR_ID = az acr show --name $ACR_NAME --query id --output tsv

az role assignment create `
    --assignee $APP_PRINCIPAL_ID `
    --role AcrPull `
    --scope $ACR_ID `
    --output table

# ── Optional: grant Cosmos DB access via managed identity ──
# If your Cosmos DB uses AAD auth (no key), uncomment and run:
#
# $COSMOS_ID = az cosmosdb show `
#     --name "agentsservicenowcosmosdb" `
#     --resource-group "<cosmos-rg>" `
#     --query id --output tsv
#
# az cosmosdb sql role assignment create `
#     --account-name "agentsservicenowcosmosdb" `
#     --resource-group "<cosmos-rg>" `
#     --role-definition-id "00000000-0000-0000-0000-000000000002" `  # Built-in Data Contributor
#     --principal-id $APP_PRINCIPAL_ID `
#     --scope $COSMOS_ID

# ──────────────────────────────────────────────
# Done — print the app URL
# ──────────────────────────────────────────────
Write-Host "`n=== Deployment complete! ===" -ForegroundColor Green
$APP_URL = az containerapp show `
    --name $APP_NAME `
    --resource-group $RESOURCE_GROUP `
    --query properties.configuration.ingress.fqdn `
    --output tsv

Write-Host "App URL: https://$APP_URL" -ForegroundColor Yellow
Write-Host "`nTo redeploy after code changes, run:" -ForegroundColor DarkGray
Write-Host "  az acr build --registry $ACR_NAME --image ${APP_NAME}:${IMAGE_TAG} --file Dockerfile ." -ForegroundColor DarkGray
Write-Host "  az containerapp update --name $APP_NAME --resource-group $RESOURCE_GROUP --image ${ACR_LOGIN_SERVER}/${APP_NAME}:${IMAGE_TAG}" -ForegroundColor DarkGray
