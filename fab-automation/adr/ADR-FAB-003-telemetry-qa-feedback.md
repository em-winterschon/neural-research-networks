# ADR-FAB-003: Telemetry and the print-quality feedback loop

- **Status:** Concept (Eva, 2026-11-26)
- **Tags:** telemetry
- **Deciders:** Eva Winterschön
- **Companion:** ../RUNBOOK.md (Phase 5); diagram: ../diagrams/fab-telemetry-dataflow.puml

## Context
An unattended printer without quality telemetry is a scrap generator with
good uptime. The house already has the sensors: multi-angle cameras
(internal + Zowiebox NDI-HX3 RTSP/RTMP), Hubitat C8 environmental sensing
(temp, humidity, motion, mmWave presence), Z-Wave outlet power metering,
and a Prometheus plant scraping the SNMP HVAC units. Matter and Thread are
explicitly out of scope (Eva, 2026-11-26).

## Decision — three telemetry layers, all LAN-local
1. **Layer 1 — Obico, self-hosted.** AI failure detection (spaghetti /
   detachment class) on the internal camera feed; auto-pause via Moonraker.
   No cloud account; no footage leaves the house.
2. **Layer 2 — Frame metrics on the QA node.** Periodic snapshots (bed
   plate RTSP angle primary): bed-clear at start, first-layer coverage,
   part-missing mid-print.
3. **Layer 3 — Environment + power.** Per job, filed into the job record:
   Hubitat room temp/humidity/HVAC state/presence (Maker API), Prometheus
   HVAC and thermal series, and outlet watts sampled across the print.
   Watts-vs-state mismatch is itself a defect signal (a "printing" job at
   idle wattage is lying).

## The feedback loop
- Every QA verdict files against exactly one row of the defect taxonomy
  (spaghetti, stringing, warping, layer shift, under-extrusion,
  first-layer fail), each row carrying its profile response.
- A verdict produces, in order: data, a proposed profile diff on a
  `qa/<job-id>` branch, and a human merge/reject decision.
- **Build result = QA verdict, not print completion.** A finished print
  that failed QA is a FAILED build in Jenkins.
- **Auto-retry: at most one**, adhesion-class failures only, after a brim
  fix. Everything else waits for a human.
- Environmental correlation is a first-class query: with the printer run
  door-and-lid open, room thermal drift is a print variable, and the loop
  must be able to separate "profile problem" from "cold room that night".
