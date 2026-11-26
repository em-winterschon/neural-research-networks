# ADR-FAB-002: Build componentry — nozzle profile classes, carriers, and the plate-swap idea

- **Status:** Concept (Eva, 2026-11-26); Section "Carrier-swap drawer" is IDEA ONLY
- **Tags:** build-componentry
- **Deciders:** Eva Winterschön
- **Companion:** ../RUNBOOK.md (Phases 1, 2, and 9b)

## Context
The K1 Max as fitted is not the stock machine: ceramic hotend/coil, 0.2 mm
ruby nozzles, a 0.4 mm hardened-steel nozzle on hand (plus several others),
multiple filament types in a Creality advanced holder with environmental
controls. Stock slicer profiles assume none of this.

## Decision
1. **Two nozzle profile classes**, versioned in git:
   - `0.2ruby` — detail class (EEG cap chassis elements).
   - `0.4hs` — structure class (carrier panels, brackets), hardened steel;
     a 0.4 ruby is a 1-3 day Prime option if the steel nozzle's state
     disappoints. Nothing is ordered by this ADR.
2. **The queue routes by part class and batches by nozzle class**, because a
   nozzle swap is a human step the scheduler cannot perform.
3. **No production part is ever sliced with an unmodified stock profile.**
   Machine, process, and per-spool filament profiles are built from the
   Phase 1 baseline prints (calibration cube, temperature tower).
4. **Headless slicing only** (OrcaSlicer CLI under Xvfb on a cluster node;
   PrusaSlicer CLI as documented fallback). Slicing never happens on the
   printer or on a closable laptop.
5. **Enclosure practice is recorded, not "fixed":** the printer normally
   runs door and lid open; the HVAC-conditioned room is the thermal
   environment (see ADR-FAB-004).

## Idea, not decision — carrier-swap drawer
Eva floated (2026-11-26, "just an idea") a pullout drawer that swaps build
plates ("carriers") so multi-unit runs need no human at all. Prior art
exists for open-frame bed-slingers (swapmod, JobOx, Chitu PlateCycler,
AutoSwap — mostly Bambu A1 family); no enclosed-CoreXY / K1 Max unit was
found. If ever promoted, its design constraints are pre-recorded in
RUNBOOK 9b: hard mechanical registration, per-carrier Z offsets keyed by
carrier ID, swap as print-job epilog / next-job prolog, seat confirmation
by sensor not camera inference, and no blind retries. This ADR records the
idea; it does not adopt it.
