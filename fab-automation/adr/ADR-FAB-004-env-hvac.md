# ADR-FAB-004: Environment and HVAC — the printer cell as a conditioned, monitored, power-managed plant

- **Status:** Concept (Eva, 2026-11-26)
- **Tags:** env-hvac
- **Deciders:** Eva Winterschön
- **Companion:** ../RUNBOOK.md (Phases 1, 4, 5, 8); diagram: ../diagrams/fab-env-hvac.puml

## Context
The printer lives in a space conditioned by the second bathroom's HVAC
system — chosen for temperature consistency and to keep acoustic load
bearable in the residence. The house's cooling plant is larger than the
printer's room: 2x SNMP-controlled Tripp Lite rack HVAC units (pandemic-era
purchase for the home server rack) under an already-built automation stack
— remote on/off, temperature control, Prometheus scraping. A 12V fan
inventory (40/60/80/92/120/140 mm) covers ducting and enclosure cooling.

## Decision
1. **The room is the chamber.** The printer runs door and lid open; thermal
   consistency is delivered by the room HVAC, not by sealing the printer.
   Therefore HVAC state is print telemetry (ADR-FAB-003, Layer 3), and a
   print job's record is incomplete without it.
2. **One metrics store.** HVAC and thermal series are queried from the
   existing Prometheus; no parallel collector is built for the printer.
3. **Power is part of the job lifecycle.** The printer sits on a switchable
   Z-Wave outlet monitor (Hubitat C8): the SLURM print job powers it on,
   waits for Moonraker, prints, cools down, and powers it off. Metering is
   sampled into the job record (energy per part).
4. **The outlet is also the out-of-band hard kill** — independent of all
   printer software. Automatic cut ONLY on fire-class signals (smoke alarm
   state, runaway wattage signature, Obico failure + temperature anomaly
   together) or explicit human command. Ordinary defects pause; they never
   cut power.
5. **Network posture:** printer hardlined on the separate print segment,
   DHCP-reserved; Moonraker/Fluidd/camera reachable only from pipeline
   hosts and Eva's + Robin's devices; no internet egress for the printer.
   Protocols in scope: Z-Wave via C8, Ethernet, RTSP/NDI, Moonraker API,
   SNMP/Prometheus for the plant. Matter/Thread: out.
6. **Unattended operation is earned:** no unattended overnight carbon runs
   until ten clean supervised completions are on the record (RUNBOOK 8).
