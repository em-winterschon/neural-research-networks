# ADR-FAB-001: Print pipeline architecture — Jenkins front door, SLURM scheduler, Moonraker sole writer

- **Status:** Concept (Eva, 2026-11-26)
- **Tags:** build-componentry, telemetry
- **Deciders:** Eva Winterschön
- **Companion:** ../RUNBOOK.md (Phases 3, 4, 6); diagram: ../diagrams/fab-components.puml

## Context
The household Creality K1 Max is operated by Robin; printing is gated on his
presence. The goal is a queued, unattended-capable batch printing process Eva
can submit and monitor, producing EEG cap chassis elements and multi-arch
carrier parts for NeuralNetOS — without turning a consumer printer into a
pile of ad-hoc scripts.

## Decision
1. **Everything is a file in git.** STL/3MF, slicer profiles, job manifests,
   and QA verdicts live in a versioned `fab-queue` repository. Profiles are
   code: a quality fix is a commit.
2. **Jenkins orchestrates, SLURM schedules.** Jenkins is the front door and
   reporting surface only. SLURM owns queueing, serialisation, dependencies,
   and accounting (Forge ADR-0012 lineage: SLURM/Ansible/Jenkins).
3. **The printer is a singleton resource**, modelled in SLURM
   (dedicated `fab` partition / GRES `print:k1max:1`, exclusive allocation).
4. **Three chained job types:** slice (CPU) -> print (singleton, `afterok`)
   -> QA (`afterany` — a failed print is still data).
5. **Moonraker is the only control path, and the SLURM print job is the only
   writer.** Jenkins never talks to the printer directly. The print lifecycle
   is four API calls: upload, start, poll, pause/cancel.
6. **Every job carries a manifest** (STL hash, profile commits, filament,
   nozzle class, QA thresholds) — the Forge delegation contract applied to
   plastic. No manifest, no print.

## Consequences
- Print history = SLURM accounting (`sacct`): what, when, how long, pass/fail.
- The design is host-agnostic: interim Jenkins/SLURM host migrates unchanged
  to the M70/Forge cluster when it comes online.
- Gate G0 stands: root + Moonraker installation changes the printer's
  firmware state; the printer is Robin's, and Phase 1 waits on his sign-off.
