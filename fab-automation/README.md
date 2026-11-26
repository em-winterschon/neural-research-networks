# fab-automation — K1 Max automated printing (concept branch)

Runbook and concept ADRs for automating the household Creality K1 Max:
Jenkins batch jobs, SLURM workflows, and print-quality feedback loops, so
printing is not gated on Robin being home. First production targets: EEG
cap chassis elements and the NeuralNetOS multi-arch carrier parts.

**Status:** concept, authored 2026-11-26. Gate G0 (Robin's sign-off on
root/Moonraker install on his printer) precedes any implementation.

## Contents
- `RUNBOOK.md` — the full runbook (Phases 1-6, learning path, open decisions)
- `adr/` — concept ADRs:
  - ADR-FAB-001 pipeline architecture — tags: build-componentry, telemetry
  - ADR-FAB-002 build componentry — tags: build-componentry
  - ADR-FAB-003 telemetry + QA feedback loop — tags: telemetry
  - ADR-FAB-004 environment + HVAC plant — tags: env-hvac
- `diagrams/` — PlantUML sources + SVG renders, unified semantic palette
  (`uml-palette.puml`, endocrine-derived; dark background always).
  Re-render with `diagrams/render-diagrams.sh` (PNG + SVG; pattern from
  LtCol Forge's render script in the GitLab RAG repo — PlantUML with
  Graphviz layout):
  - `fab-components` — pipeline component view
  - `fab-telemetry-dataflow` — telemetry + QA loop view
  - `fab-env-hvac` — environment / HVAC / power view

Tags used across this branch: **build-componentry**, **telemetry**, **env-hvac**.
