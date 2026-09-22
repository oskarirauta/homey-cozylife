Control your CozyLife, DoHome, and Doiting smart switches locally on Homey Pro via TCP port 5555 — 100% cloud-free, fast, and reliable.

FEATURES
* 100% Local Control: Direct connection via TCP port 5555 on your local network. No cloud or internet connection required.
* Instant Updates: Real-time status push and heartbeat monitoring (< 100ms).
* Multi-Gang Support: Full support for 1, 2, 3, and 4-gang switches with independent relay control.
* Rich Flows: Triggers (turned on/off), conditions (is on/off), and actions (turn on/off, toggle, turn all on/all off).
* Two-Way Sync: Easily use unattached switch gangs as wireless remotes for other lights without feedback loops.

SUPPORTED DEVICES
* 1-Gang Switch
* 2-Gang Switch
* 3-Gang Switch
* 4-Gang Switch
(Compatible with CozyLife, DoHome, and Doiting Wi-Fi smart switches and relays)

PAIRING INSTRUCTIONS
1. Connect the switch to your 2.4 GHz Wi-Fi network:
   - For Apple HomeKit models on iPhone: Add the accessory first via Apple Home (scan the QR code or enter the 8-digit setup code). Once joined to Wi-Fi, port 5555 is active locally.
   - For standard models / Android: Set up Wi-Fi using the CozyLife mobile app.
2. In your router settings, assign a static DHCP reservation (fixed IP) for the switch.
3. In Homey, tap Add Device -> CozyLife -> select your switch model.
4. Enter the switch IP address (port 5555) to pair.
