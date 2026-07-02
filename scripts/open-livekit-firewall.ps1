# Allow LiveKit media ports on Windows Firewall (run as Administrator)
$rules = @(
  @{ Name = "Hotel VoIP LiveKit TCP 7880"; Port = 7880; Protocol = "TCP" },
  @{ Name = "Hotel VoIP LiveKit TCP 7881"; Port = 7881; Protocol = "TCP" },
  @{ Name = "Hotel VoIP LiveKit UDP 7882"; Port = 7882; Protocol = "UDP" },
  @{ Name = "Hotel VoIP LiveKit UDP 50000-50100"; Port = "50000-50100"; Protocol = "UDP" }
)

foreach ($rule in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
  if ($existing) {
    Write-Host "Rule already exists: $($rule.Name)"
    continue
  }
  New-NetFirewallRule -DisplayName $rule.Name -Direction Inbound -Action Allow -Protocol $rule.Protocol -LocalPort $rule.Port | Out-Null
  Write-Host "Added: $($rule.Name)"
}

Write-Host "Done. LiveKit ports should be reachable from tablets on your LAN."
