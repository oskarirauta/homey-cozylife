# CozyLife & DoHome for Homey Pro

Control your **CozyLife** and **DoHome** smart switches locally on **Homey Pro** via TCP socket (port 5555) — **100% cloud-free, fast, and reliable**.

[![Homey SDK](https://img.shields.io/badge/Homey_SDK-v3-blue.svg)](https://apps.developer.homey.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

---

## Features

- **100% Local Control**: Connects directly to the switch over your local Wi-Fi network (TCP port 5555). No internet connection or cloud service required for operation.
- **Instant Status Updates**: Listens to device push events and maintains an active heartbeat. Physical button presses reflect in Homey in real time (< 100ms).
- **Multi-Gang Support**: Full bitmask protocol integration supporting multi-relay switches with independent gang control.
- **Rich Flow Cards**:
  - **Triggers**: Gang turned on, Gang turned off.
  - **Conditions**: Gang is currently on / off.
  - **Actions**: Turn specific gang on / off, toggle specific gang, turn all gangs on, turn all gangs off.
- **Robust Connection Handling**: Automatic background reconnection with exponential backoff and connection state monitoring.
- **Two-Way Sync Compatible**: Designed to seamlessly sync multiple switches (e.g., using Gang 2 as a wireless controller for another light) without feedback loops.

---

## Supported Devices

| Device | Model / Type | Capabilities |
| :--- | :--- | :--- |
| **1-Gang Switch** | Single relay in-wall / wall switch | `onoff` |
| **2-Gang Switch** | Dual relay switch | `onoff.gang1`, `onoff.gang2` |
| **3-Gang Switch** | Triple relay switch | `onoff.gang1`, `onoff.gang2`, `onoff.gang3` |
| **4-Gang Switch** | Quad relay switch | `onoff.gang1`, `onoff.gang2`, `onoff.gang3`, `onoff.gang4` |

*Compatible with CozyLife and DoHome Wi-Fi smart switches and relays.*

---

## Installation & Pairing

### Prerequisites
1. Set up the switch on your Wi-Fi network using the CozyLife mobile app or local provisioning.
2. **Recommended:** Assign a static IP or DHCP reservation for the switch in your Wi-Fi router settings so the IP address remains constant.

### Pairing in Homey
1. Open the Homey app and tap **+ (Add Device)**.
2. Search for **CozyLife** and select the device driver matching your switch (1, 2, 3, or 4 Gang).
3. Enter the **IP address** of the switch (default port is `5555`).
4. Homey will establish a local socket connection, probe the switch, and pair the device.

---

## Flow Examples

### 1. Two-Way Switch Sync (Advanced Flow)
If you have a 2-gang switch where Gang 2 does not have a physical load attached, you can use it as a remote control for another light:

```
[WHEN: Gang 2 turned on]  ──► [THEN: Turn on Ceiling Light]
[WHEN: Gang 2 turned off] ──► [THEN: Turn off Ceiling Light]
```

To keep Gang 2's status indicator in sync when the Ceiling Light is toggled elsewhere:
```
[WHEN: Ceiling Light turned on]  ──► [THEN: Turn on Gang 2]
[WHEN: Ceiling Light turned off] ──► [THEN: Turn off Gang 2]
```
*The driver filters redundant state updates to prevent command echo or infinite loops.*

### 2. "Goodnight" / All Off
Turn off all switches or all gangs with a single Flow action:
```
[WHEN: Flow started "Goodnight"] ──► [THEN: Turn all gangs off]
```

---

## Technical Details

CozyLife devices use an encrypted/unencrypted JSON-based protocol over raw TCP port 5555. Multi-gang devices communicate relay states through an integer bitmask payload under DPID `1`:

| Bit | Value | Relay |
|:---:|:---:|:---|
| 0 | `1` | Gang 1 |
| 1 | `2` | Gang 2 |
| 2 | `4` | Gang 3 |
| 3 | `8` | Gang 4 |

State changes and queries use packet structures formatted as:
```json
{"cmd": 10, "data": {"1": <bitmask>}}
```

---

## Development

```bash
# Clone the repository
git clone https://github.com/oskarirauta/homey-cozylife.git
cd homey-cozylife

# Install dependencies
npm install

# Build TypeScript
npm run build

# Run unit tests
npm test

# Run app in development mode on Homey
homey app run

# Validate app for publication
homey app validate --level verified
```

---

## License

This project is licensed under the [MIT License](LICENSE) - see the LICENSE file for details.

Developed by [Oskari Rauta](https://github.com/oskarirauta).
