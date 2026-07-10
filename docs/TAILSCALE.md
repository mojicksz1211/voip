# Tailscale Hybrid Setup

This guide lets the hotel intercom work on the local hotel Wi-Fi and through Tailscale when a device is on mobile data or another Wi-Fi network.

## What to install

Install Tailscale on every device that needs remote access:

- Hotel PC running the PBX server and LiveKit
- Guest tablets
- Front desk tablet or PC
- Optional admin phone

All devices must sign in to the same Tailscale account or tailnet.

## Get the server addresses

On the Hotel PC, open PowerShell.

For the local hotel Wi-Fi address:

```powershell
ipconfig
```

Use the IPv4 address of the active Wi-Fi or Ethernet adapter, for example:

```text
http://192.168.110.50:3000
```

For the Tailscale address:

```powershell
tailscale ip -4
```

Use the returned `100.x.x.x` address, for example:

```text
http://100.101.23.45:3000
```

## Open Windows Firewall

Run the firewall helper as Administrator:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\open-livekit-firewall.ps1
```

The PBX server listens on `0.0.0.0`, so it can accept both LAN and Tailscale traffic.

## Start the servers

From the project root:

```bash
npm run dev:all
```

The console prints the LAN and Tailscale URLs when available:

```text
PBX API LAN:        http://192.168.110.50:3000/api/
PBX API Tailscale:  http://100.101.23.45:3000/api/
LiveKit WS LAN:     ws://192.168.110.50:7880
LiveKit WS Tailscale: ws://100.101.23.45:7880
```

## Configure tablets

Use the app's PBX Server Setup screen on first install, or use the quick switcher in Settings:

- **Guest app:** Settings → **Hotel Wi-Fi** or **Remote**
- **Front desk:** Settings tab → **Hotel Wi-Fi** or **Remote**

- Same hotel Wi-Fi: use **Hotel Wi-Fi** (LAN)
- Mobile data or another Wi-Fi: use **Remote** (Tailscale)

If the setup screen is loaded from the PBX server, it can show quick-select buttons for LAN and Tailscale.

## Android kiosk tablets

For guest tablets:

1. Install Tailscale from the Play Store.
2. Sign in to the same tailnet as the Hotel PC.
3. Enable Tailscale's startup/background options if available.
4. Keep the app configured to the LAN IP while onsite.
5. Switch to the Tailscale IP only when testing from another network.

## Testing matrix

| Test | Expected result |
| --- | --- |
| Guest tablet LAN URL to front desk LAN URL | Call signaling and voice work |
| Guest tablet Tailscale URL to front desk Tailscale URL | Call signaling and voice work |
| Guest tablet LAN URL to front desk Tailscale URL | Mixed LAN/Tailscale call works |
| Front desk on mobile data with Tailscale enabled | Events, heartbeat, and voice work |
| Tailscale off while using `100.x.x.x` URL | Connection fails until Tailscale is turned on |
| Same hotel Wi-Fi using LAN URL | Local access still works |

## Troubleshooting

- If the PBX URL cannot connect, verify `npm run dev:all` is running on the Hotel PC.
- If the `100.x.x.x` URL cannot connect, verify Tailscale is connected on both devices.
- If signaling works but voice does not, check Windows Firewall for LiveKit ports `7880`, `7881`, `7882/udp`, and `50000-50100/udp`.
- If the wrong LiveKit URL is used, leave `LIVEKIT_WS_URL` unset so each client derives LiveKit from its own configured PBX URL.
