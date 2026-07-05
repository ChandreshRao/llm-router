# Generate ADMIN_TOKEN and ENCRYPTION_KEY for local dev or wrangler secret put.
$ErrorActionPreference = 'Stop'

function Get-RandomAlnum([int]$Length) {
  $chars = (48..57) + (65..90) + (97..122)
  $bytes = New-Object byte[] $Length
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }
  -join ($bytes | ForEach-Object { [char]$chars[$_ % $chars.Length] })
}

$adminToken = Get-RandomAlnum 48
$encryptionKey = Get-RandomAlnum 64

@"

# ADMIN_TOKEN — used to sign in to the admin UI
$adminToken

# ENCRYPTION_KEY — encrypts provider API keys in D1 (min ~32 chars)
$encryptionKey
"@
