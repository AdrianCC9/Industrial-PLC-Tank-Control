# Industrial PLC Tank Control & Monitoring System

A hardware-free industrial automation project developed on an Apple Silicon Mac. A virtual OpenPLC controller simulates a tank filling to 80%, draining to 20%, and repeating. A Node-RED HMI communicates with it via Modbus TCP.

## What is implemented

- IEC 61131-3 Structured Text for tank sequencing and simulated valve outputs
- Ladder Logic function block `HighLevelAlarmFB` with a normally-open `AtOrAbove75` contact driving the `Alarm` coil
- OpenPLC Runtime v4.3.2 running in a Docker/Colima Linux container
- Modbus TCP server on port 5020
- Node-RED / FlowFuse Dashboard 2.0 with live tank gauge, trend, cycle counter, valve indicators, and operator switches
- High-level warning sourced from a PLC alarm coil in the reviewed Node-RED export

**Status:** The PLC compiled and deployed successfully, and tank/cycle registers were observed updating over Modbus. The uploaded dashboard export was reviewed and cleaned; the *revised* export still needs to be imported/deployed and its updated controls and PLC alarm tested on the author's Mac. Python logging is an optional next step, not yet verified.

## System architecture

```text
OpenPLC Editor (Structured Text + Ladder Logic)
             |
             v
OpenPLC Runtime v4 (Docker / Colima)
             |
             | Modbus TCP (127.0.0.1:5020)
             v
Node-RED (FlowFuse Dashboard 2.0)
```

## Modbus address map

Addresses shown are **zero-based**; the following map depends on the OpenPLC Modbus server buffer configuration.

| Modbus location | PLC variable | Meaning |
| --- | --- | --- |
| Holding register 0 | `%QW0` | Tank level (%) |
| Holding register 1 | `%QW1` | Completed cycles |
| Coil 0 | `%QX0.0` | Fill valve |
| Coil 1 | `%QX0.1` | Drain valve |
| Coil 2 | `%QX0.2` | PLC high-level alarm |
| Coil 8 | `%MX0.0` | AutoRun command |
| Coil 9 | `%MX0.1` | Simulated Stop command |

OpenPLC Modbus configuration: 8 `%QX` bits, 8 `%MX` bits, and 2 `%QW` words, exposed over TCP port 5020, Unit ID 1.

## Node-RED dashboard

The export is in [`node-red/tank-dashboard.json`](node-red/tank-dashboard.json). Import it using **Node-RED → Menu → Import**, then deploy after confirming that the FlowFuse Dashboard and `node-red-contrib-modbus` packages are installed.

The reviewed export removes an unused duplicate dashboard page/group, fixes display labels, uses the **PLC coil 2** as the only high-level alarm source, sets the alarm polling Unit ID to 1, and adds polling of coils 8–9 so switch positions can reflect the PLC state. These changes are **not yet verified live**; test them before relying on the switches.

Required Node-RED packages:
- `node-red-contrib-modbus` (export version: 5.62.1)
- `@flowfuse/node-red-dashboard` (export version: 1.36.1)

The dashboard should be accessible at `http://localhost:1880/dashboard/tank-control` on the author's machine.

## Run locally

1. Start the existing Colima VM and OpenPLC container:
   ```bash
   colima start
   docker start openplc-runtime
   docker ps
   ```
2. Open the native OpenPLC Editor project, then build and upload to Runtime v4 at `127.0.0.1:8443`.
3. Start Node-RED with `node-red`.
4. Import/deploy `node-red/tank-dashboard.json`; verify the Modbus client is set to `127.0.0.1:5020`.
5. Enable Automatic Mode and verify the tank fills and drains. The simulated Stop switch must disable both valves.

The native OpenPLC Editor project is included at the repository root. Open `project.json` in OpenPLC Editor; the source POUs are under `pous/`, device configuration is under `devices/`, and generated Runtime v4 sources are under `build/`.

## Verification

Already observed:
- OpenPLC compiling both `pou_HIGHLEVELALARMFB.cpp` and `pou_MAIN.cpp`
- `Compilation completed successfully (exit code: 0)`, `PLC started`, and `Upload complete`
- Holding registers updating, including tank level and cycle count
- Coil 2 returned 0 in a single Modbus read; this **only establishes that the alarm was off at the moment of the read**

Still to verify:
- Coil 2 reads 1 when the tank level reaches 75–80%, then 0 below 75%
- Updated dashboard alarm source and both switch feedback paths
- Optional Python logger and representative CSV samples, if implemented

To continuously observe coil 2, omit the `-1` single-poll flag:

```bash
mbpoll -m tcp -p 5020 -a 1 -t 0 -0 -r 2 -c 1 127.0.0.1
```

Stop polling with Ctrl+C.

## Safety and scope

This is a software simulation for learning. The Stop command is **not** a safety-rated emergency stop. No physical tank or PLC hardware is controlled.
