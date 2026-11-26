# Runbook: Automated Printing on the Creality K1 Max
## Jenkins batch jobs + SLURM workflows + print-quality feedback loops

**Version:** v1, 2026-11-26 (authored in flight, LY49, at Eva's direction)
**Purpose:** End the print gate. Today the K1 Max only runs when Robin is home to
operate it (it is his printer — Eva's birthday gift to him, upgrades likewise).
This runbook makes printing a queued, unattended-capable, self-checking batch
process that Eva can submit, monitor, and learn from while Robin is at work in SF.
**First production targets:** EEG cap chassis elements (STL via Hurmez/Chaldean
Labs exchange) and the multi-arch carrier elements from the portable stack goal.
**Backlog proof case:** the RM51 airflow baffles and carbon cross-braces,
proposed months ago and still unprinted — they are job #1 and #2 in the queue
when this pipeline goes live.

---

## 0. Known state of the machine (from Eva's record — verify on site, Phase 1)

| Item | State |
|---|---|
| Printer | Creality K1 Max, 300 x 300 x 300 mm, Klipper-based Creality OS |
| Hotend | Upgraded ceramic hotend/coil (high-temp) |
| Nozzles | 0.2 mm ruby tips (abrasive-rated — correct for carbon filament) |
| Filament intent | Carbon-filled, high-temp, high-speed |
| Nozzles (Eva, 2026-11-26) | 0.2 ruby fitted/on hand; a 0.4 hardened steel (her recollection — verify in Phase 1) plus several others. A 0.4 ruby is obtainable in 1–3 days via Amazon Prime if wanted — option, not a decision |
| Filament stock (Eva, 2026-11-26) | Multiple filament types on hand |
| Filament storage | Creality advanced filament holder with environmental-condition controls (exact SKU not memorised), purchased with the original system, same date — i.e. controlled dry storage already exists; stringing/wet-filament handling starts from a good baseline |
| Network (Eva, 2026-11-26) | A separate print network and WiFi are available at home; hardlining the printer is easy — decision recorded in Phase 1: Ethernet on the print segment, no internet egress |
| Location / environment (Eva, 2026-11-26) | Printer runs under the second bathroom's HVAC system, used deliberately for temperature-control consistency and to keep acoustic load bearable in the residence |
| Enclosure practice (Eva, 2026-11-26) | Normally run with door AND lid open — the chamber is not a sealed heated box in their operation; the room's HVAC conditioning is the thermal environment, which makes Layer 3 room telemetry a first-class print variable, not a nicety |
| Environmental monitoring | Hubitat C8 (hardline + WiFi) already monitors all environmental aspects; sensor pool includes standard motion, mmWave presence, and many temp + humidity sensors |
| Cameras (Eva, 2026-11-26) | Multiple USB and HDMI-capable webcams, incl. a Zowiebox NDI-HX3 encoder (RTSP/RTMP/NDI feeds), multiple tripods, plenty of PoE injectors and PoE splitters — multi-angle monitoring is a solved problem, not a purchase |
| Power control (Eva, 2026-11-26) | Many switchable Z-Wave outlet monitors on the Hubitat C8 — per-outlet switching AND power metering available for the printer and its peripherals |
| Cooling / HVAC plant (Eva, 2026-11-26) | 2x Tripp Lite rack HVAC units, SNMP-controlled, bought during the pandemic to chill the home server rack; full automation stack already built — remote on/off, temperature-controlled, with a Prometheus scraper. Fan inventory: many 12V fans in 40 / 60 / 80 / 92 / 120 / 140 mm |
| Printer upgrade path (not owned) | Upgraded servos and a control board for the K1 Max that Robin was interested in — his interest, recorded as a possible future upgrade lane (and relevant to the 9b drawer idea's motion needs); NOT purchased, do not treat as inventory |
| Operator of record | Robin. Eva does not operate it (yet — this runbook) |
| Eva's background | Metal shop: pneumatics, grinders, Al + ballistic steel |

**Not yet known — Phase 1 verifies, do not assume:**
printer IP / DHCP state, firmware version, whether root is already enabled,
exact nozzle-by-nozzle inventory, exact spool-by-spool filament inventory,
where the printer sits and what the camera can see.

**Gate G0 — Robin's sign-off.** Rooting and the Helper Script change *his*
machine's firmware state and may affect warranty. Nothing in Phase 1 runs
until Robin says go. This is his printer; the automation serves him too
(his queue drains while he is at work), but the decision is his.

---

## 1. Architecture

```
                 git repo: fab-queue
                 (STL/3MF + slicer profiles + job manifests, all versioned)
                              |
                         Jenkins pipeline
                    (validate, enqueue, report)
                              |
                    SLURM (Forge-pattern cluster)
              +---------------+----------------+
              |               |                |
         slice jobs      print job        QA jobs
         (CPU nodes:    (singleton:      (camera frames ->
          M70 / x86)     printer GRES)    defect scoring)
              |               |                |
              +-------> Moonraker API <--------+
                        K1 Max (Klipper)
                              |
                     camera stream (port 8080)
                              |
                    Obico (self-hosted, LAN only)
                    failure detection + timelapse
                              |
              QA verdict -> Jenkins status -> profile fix
              committed back to fab-queue (the feedback loop)
```

Protocol scope (Eva, 2026-11-26): Z-Wave via the Hubitat C8, Ethernet,
RTSP/NDI, Moonraker. **Matter and Thread are explicitly out** — do not
design them into this system.

Design rules, Forge-pattern throughout:

- **The printer is a singleton resource.** Exactly one print job at a time,
  enforced by the scheduler, never by politeness. Model it in SLURM as a
  generic resource (`GRES print:k1max:1`) or a dedicated one-node partition
  `fab` with exclusive allocation.
- **Everything is a file in git.** STL, profiles, job manifests, QA verdicts.
  If it is not in `fab-queue`, it did not happen. Profiles are code: a quality
  fix is a commit, reviewable and revertable.
- **Slicing is a CPU batch job**, not a GUI session. It runs on the cluster
  (M70s are ideal: patient, ECC, always-on), never on the printer, never on
  a laptop that might close.
- **Jenkins orchestrates, SLURM schedules.** Jenkins is the front door and
  the reporting surface; SLURM owns queueing, serialisation, dependencies,
  and accounting. This matches Forge's existing ADR pattern
  (SLURM/Ansible/Jenkins, ADR-0012 lineage).
- **The QA loop closes on profiles, not on hope.** A defect produces data,
  a profile change, and a reprint decision — in that order.

---

## 2. Phase 1 — Printer network + API access (one evening, with Robin)

1. **Fixed address, hardlined, on the print network.** A separate print
   network + WiFi exist at home, and hardlining is easy (Eva, 2026-11-26) —
   so: Ethernet, not WiFi. WiFi drops are how a 9-hour print job loses its
   monitor at hour 7; a cable does not have opinions. Printer lives on the
   separate print segment with a DHCP reservation. Access rules for that
   segment: Moonraker (7125), Fluidd (4408), and the camera (8080) reachable
   ONLY from the Jenkins/SLURM/QA hosts and Eva's + Robin's own devices;
   the printer gets no internet egress (LAN mode; Creality cloud is not a
   dependency of anything in this runbook, and Obico is self-hosted
   precisely so no footage or control path leaves the house).
2. **Enable root.** On the printer: Settings -> Root account information ->
   scroll, accept. This opens SSH (user `root`; the stock password is shown
   by the printer / documented as `creality_2023` on stock firmware — change
   it and put the new one in Bitwarden, never in this repo).
3. **Install the standard Klipper stack** via the Guilouz Creality Helper
   Script over SSH (the community-standard path for the K1 family):
   Moonraker + Fluidd at minimum; camera service and Obico agent as options
   in the same menu. Stock Creality OS does **not** ship Moonraker — this
   step is what makes the printer API-addressable.
   - Moonraker API: `http://<printer-ip>:7125`
   - Fluidd UI: `http://<printer-ip>:4408`
   - Camera stream: `http://<printer-ip>:8080/?action=stream`
4. **Smoke test from any LAN host** (no print, just truth):
   - `curl http://<ip>:7125/printer/info`
   - `curl http://<ip>:7125/printer/objects/query?print_stats`
   Both must answer before Phase 2. If they do not, the Helper Script
   install is the suspect, not the network.
5. **Baseline calibration prints, Robin present:** one calibration cube and
   one temperature tower in the house carbon filament. These two prints are
   the QA loop's ground truth — photograph them, keep them, label them.

**Exit criteria:** Moonraker answers from the LAN; Fluidd loads; camera
stream visible; baseline parts in hand.

---

## 3. Phase 2 — Headless slicing (the slicer is a batch tool now)

Tool: **OrcaSlicer CLI** (the K1 community standard; PrusaSlicer CLI is the
fallback — its CLI is formally documented if Orca's flags fight back).

- Orca's CLI is real but thinly documented. The working core invocation:

```
orca-slicer \
  --slice 1 \
  --load-settings "profiles/k1max-machine-0.2ruby.json;profiles/process-carbon-0.2.json" \
  --load-filaments "profiles/filament-carbon.json" \
  --outputdir out/ \
  model.stl
# -> out/plate_1.gcode ; rename to the job's canonical name on ingest
```

- On a headless Linux node the CLI wants a display: run it under `Xvfb`
  (a permanent virtual framebuffer service, not a shell hack).
- `--export-3mf out.gcode.3mf` when a sliced-project archive is wanted
  alongside raw G-code.

**Profile discipline — this is where the 0.2 ruby nozzle bites:**

- Stock K1 Max profiles assume a 0.4 mm nozzle. Ours is **0.2 mm ruby**.
  Line width, flow rate, volumetric speed, retraction, and print time all
  change. Never slice a production part with an unmodified stock profile.
- Build three versioned profiles in `fab-queue/profiles/`:
  1. `machine` — K1 Max + 0.2 ruby + ceramic hotend, as actually fitted.
  2. `process-carbon-0.2` — layer height, walls, speeds derated for a 0.2
     orifice pushing abrasive carbon filament. Expect long plate times;
     the scheduler, not Eva, waits them out.
  3. `filament-<each spool>` — one per filament actually on hand, with its
     real temperature window from the Phase 1 tower.
- Ruby + ceramic is the right pairing for carbon: abrasive fill eats brass;
  ruby does not care. The cost is throughput, not quality — fine detail for
  cap chassis elements is exactly what 0.2 is for. Large flat carrier
  panels route to the **0.4 class**: a 0.4 hardened steel is on hand (Eva's
  recollection, verify in Phase 1) — hardened steel also survives carbon
  fill — and a 0.4 ruby is a 1–3 day Prime order if the steel one's state
  disappoints. Two machine profiles (`0.2ruby`, `0.4hs`), queue routes by
  part class: detail -> 0.2, panels/structure -> 0.4. Nozzle swaps are a
  manifest field and a pre-flight check, because a swap is a human step
  the scheduler cannot do — the queue batches same-nozzle jobs together.

**Exit criteria:** a Phase 1 cube re-sliced headlessly on a cluster node
prints identically to the GUI-sliced baseline.

---

## 4. Phase 3 — Job submission via Moonraker (the printer's API contract)

The whole print lifecycle is four HTTP calls. Everything above this layer
(Jenkins, SLURM, scripts) exists to make these four calls safely.

```
# 1. Upload G-code into the printer's gcodes root
curl -X POST -F "file=@out/job.gcode" -F "root=gcodes" \
  http://<ip>:7125/server/files/upload

# 2. Start it
curl -X POST "http://<ip>:7125/printer/print/start?filename=job.gcode"

# 3. Poll state (the print job's heartbeat)
curl "http://<ip>:7125/printer/objects/query?print_stats&virtual_sdcard"

# 4. Stop paths — pause first, cancel is destructive
curl -X POST http://<ip>:7125/printer/print/pause
curl -X POST http://<ip>:7125/printer/print/cancel
```

Rules:

- **Pre-flight gate before every start:** printer state `standby`, bed and
  nozzle at ambient (no leftover job), filament loaded matches the job
  manifest, previous part cleared from the bed. The first three are API
  checks. Bed-clear is a camera-frame check (Phase 5) plus, until that is
  trusted, a human glance at the Fluidd camera — Eva's, from the couch,
  which is the entire point: the glance is 10 seconds, not a print session.
- **One manifest per job** (`job.yaml` in git): STL hash, profile commits,
  filament, estimated time/grams, part class, QA thresholds. The print job
  refuses to start without one. This is the Forge delegation contract
  applied to plastic: objective, scope, evidence, completion format.

---

## 5. Phase 4 — SLURM workflows (the queue is the product)

Interim host note: until the sideboard/M70 bring-up lands, SLURM + Jenkins
can live on any always-on home host. The workflows below do not care which
node runs them; they migrate to Forge's cluster unchanged when it revives.

Three job types, chained by dependency:

```
# A. Slice job — CPU, minutes
#SBATCH --job-name=fab-slice --partition=compute --cpus-per-task=4
# runs OrcaSlicer CLI under Xvfb; writes G-code + slice report to the
# job's spool dir on NFS; fails the chain if the slicer warns (--strict)

# B. Print job — singleton, hours; runs ONLY after A succeeds
#SBATCH --job-name=fab-print --partition=fab --exclusive
#SBATCH --dependency=afterok:<A>
# power lifecycle via a Z-Wave outlet monitor on the Hubitat C8:
#   outlet ON -> wait for Moonraker to answer -> pre-flight checks ->
#   upload -> start -> poll loop until complete/error ->
#   cool-down (nozzle below threshold) -> outlet OFF
# heartbeat: writes state + latest camera frame path every 60 s
# metering: outlet watts sampled into the job record (kWh per part is a
# real accounting number in sacct terms — filament AND energy per part)

# C. QA job — runs after B regardless of outcome
#SBATCH --job-name=fab-qa --dependency=afterany:<B>
# scores the print (Phase 5), files the verdict to git, notifies
```

- Submit the chain from one wrapper (`fab-submit job.yaml`): it runs A,
  captures the job ID, submits B and C with dependencies. Fire-and-forget
  is the design goal — Eva submits from the tablet and walks away.
- **Accounting is the memory:** `sacct` history per part name becomes the
  print log — what was printed, when, how long, pass/fail. No notebook.
- Failed print != failed chain: C still runs, because a failure *is* data.

---

## 6. Phase 5 — Print-quality analysis + the feedback loop

Two layers, cheap first, smart second:

**Layer 1 — Obico, self-hosted on the LAN** (the open-source failure
detective; K1 family is a documented install path via the same Helper
Script ecosystem). Watches the camera stream, detects spaghetti / detachment
class failures, and can auto-pause via Moonraker. LAN-only deployment: no
cloud account, no footage leaves the house. Its verdict (clean / warning /
failure + confidence) is the QA job's first input.

**Layer 2 — Frame metrics + environment on the QA node** (Orin when online,
CPU until then): periodic snapshots, checked for the boring killers Layer 1
is not for — bed not clear at start, first-layer coverage wrong, part
missing from bed mid-print (= it is on the floor or the nozzle).
Camera hardware is already in the house (Eva, 2026-11-26): multiple USB and
HDMI webcams, a Zowiebox NDI-HX3 giving RTSP/RTMP/NDI feeds, tripods, and
PoE injectors/splitters to power and place them. Standard rig: angle 1 =
stock internal camera (Obico's feed), angle 2 = Zowiebox RTSP aimed at the
bed plate (first-layer + bed-clear checks), angle 3 (optional) = wide shot
of the printer corner for human review. All feeds stay on the print segment.

**Layer 3 — Environmental telemetry via Hubitat C8 + Prometheus.** The C8
already monitors the printer's environment; the QA job pulls it per print
(Hubitat Maker API, LAN-local): room temp + humidity (several sensors
available), HVAC state of the second-bathroom system that conditions the
printer space, and mmWave/motion presence. Filed into the job record
alongside the frames. Second source, already built: the rack HVAC plant
(2x SNMP Tripp Lite units, remote on/off, temperature-controlled) is
scraped by Prometheus — the QA job queries the same Prometheus for HVAC
and thermal series instead of building a parallel collector. One metrics
store for the house's machines, printers included. The 12V fan inventory
(40–140 mm) covers any ducting/enclosure-cooling the cell needs, printed
brackets included — no cooling purchases on this project.
Why it earns its place: warping and adhesion failures correlate with room
thermal drift — with the environment logged per job, the QA loop can
separate "profile problem" from "the room was 4 degrees colder that night"
instead of chasing ghosts. Presence data also answers "did a human already
clear the bed?" better than a camera guess.

**Defect taxonomy — every QA verdict files against exactly one row:**

| Defect | Likely cause | Profile response |
|---|---|---|
| Spaghetti | Adhesion loss, support fail | Bed temp / brim / first-layer |
| Stringing | Retraction, wet filament | Retraction + dry-box note |
| Warping | Thermal gradient, carbon shrink | Chamber/bed temp, brim |
| Layer shift | Belt, accel too high for 0.2 | Accel derate in process |
| Under-extrusion | Partial clog, flow | Flow ratio; inspect ruby tip |
| First-layer fail | Z offset, dirty bed | Z offset commit; clean-bed step |

**The loop, mechanically:**
QA verdict -> Jenkins marks the build -> a `qa/<job-id>` branch in
`fab-queue` carries the frame grabs, the verdict, and (for profile-class
defects) a proposed profile diff -> Eva reviews the diff like code, merges
or rejects -> next print of that part uses the merged profile.
**Auto-retry policy: at most one**, and only for adhesion-class failures
after a brim fix. Everything else waits for a human decision. Plastic and
time are cheap; a silently drifting process is not.

---

## 7. Phase 6 — Jenkins front door

One pipeline job, `fab-print`, parameterised by the job manifest path:

1. Validate manifest + STL hash against git.
2. `fab-submit` the SLURM chain; record the three job IDs as build data.
3. Poll SLURM state; stream the print heartbeat into the build log.
4. On QA completion, post the verdict + first/last frame grabs to the
   build page and notify (ntfy — Forge's native channel pattern).
5. Build result = QA verdict, not print completion. A finished print that
   failed QA is a FAILED build. That inversion is the whole philosophy.

Jenkins never talks to the printer directly. SLURM's print job does.
One writer to the machine, ever.

---

## 8. Eva's learning path (metal shop -> FDM, honestly translated)

You are not a beginner at fabrication. You are an expert in a process with
different physics. Translation table first, then the exercises:

| Metal shop | FDM equivalent |
|---|---|
| Feeds and speeds | Flow rate and print speed |
| Tool (end mill, wheel) | Nozzle (0.2 ruby = fine finishing tool) |
| Stock | Filament spool (carbon fill = abrasive stock) |
| Workholding | Bed adhesion (brim = a fixture, not a hope) |
| Cutting fluid / heat mgmt | Nozzle + chamber temps, part cooling |
| Chatter | Ringing / ghosting (accel + belt tune) |
| Warped plate after weld | Warped part after print (same enemy: gradient) |
| Scrap and rework | Failed print + QA verdict (cheaper scrap, faster) |
| Calipers don't lie | Calipers still don't lie — measure every part |

**Week 1 exercises (queued jobs, not homework):**
1. Calibration cube — measure all axes, file readings in the job record.
2. Temperature tower — pick the carbon filament's real window yourself.
3. Retraction test — stringing, seen once, recognised forever.
4. The RM51 baffle — a real part, end to end, through the full pipeline.
5. Break something on purpose: kill adhesion mid-print, watch Obico catch
   it, read the QA verdict. Knowing the failure path is the skill.

Safety, stated once, plainly: unattended printing is earned, not assumed.
Klipper's thermal protections stay on; Obico auto-pause armed; the printer
sits where a smoke alarm hears it; no unattended overnight carbon runs
until the pipeline has ten clean supervised completions. Your house,
your rules — these are the defaults until you change them.
**Hard stop, independent of all printer software:** the printer's Z-Wave
outlet monitor (Hubitat C8) is the out-of-band kill. Policy: automatic
power cut ONLY on fire-class signals (smoke alarm state, runaway wattage
signature, Obico failure + temperature anomaly together) or a human's
explicit command — never for ordinary print defects, which pause instead.
A hard cut mid-print destroys the part; that is acceptable for fire-class
events and for nothing else. The same outlet's metering also catches a
silent failure mode: a print that "runs" for hours at idle wattage is not
printing, whatever the API claims — the QA layer checks watts against
state and flags the mismatch.

---

## 9b. Extension — automated carrier-swap drawer (IDEA ONLY, 2026-11-26)

**Status: an idea Eva floated in flight, explicitly "just an idea" — not a
commitment, not a task, not scheduled.** Recorded so it is not lost; it
authorises no work. If it is ever promoted, it happens on her word then.

Prior art check (2026-11-26, at Eva's "maybe already exists"): the
*concept* is a real product category — swapmod and JobOx (Bambu A1
family), HICTOP Swapper (A1, STL kit), Chitu PlateCycler C1M (A1 Mini,
~$80, purely mechanical, G-code driven), AutoSwap (Bambu A1 / Anycubic
Kobra 3, with SimplyPrint queue integration), FlyingBear's Ghost7 APS
carousel (Kickstarter, own printer only), and industrial machines
(Uniway NEO3) ship automatic plate changers. **But every desktop unit
found targets open-frame bed-slingers, mostly the Bambu A1 line. No
K1 Max — or any enclosed CoreXY — plate changer was found.** The K1
Max's bed moves in Z only, inside a closed chamber, so a drawer through
the door is a genuinely different geometry from the bed-slinger kits:
the idea stands as original-for-this-machine, with the A1 kits as
mechanical references (magazine + registration + G-code-driven swap).

The idea: fab a pullout drawer that swaps print carriers (build
plates), so multi-unit runs complete with **no human in the loop at all**.
It would remove the last routine human step — clearing the bed — which
until then remains the bed-clear glance in the Phase 3 pre-flight.

Design notes, to be developed when she is at the bench:

- **Access path is already open.** The printer normally runs door and lid
  open (Section 0), so a front drawer needs no door actuator or lid
  mechanism — the swap path is the opening that is already there. (This
  also means the chamber is room-conditioned during a swap, same as
  during a print; no thermal state is being "let out" that was not
  already out.)
- **Carrier = the unit of work.** Each build plate is a carrier with an
  identity (index position at minimum; a tag if we want the machine to
  prove it). The drawer/magazine holds N carriers: run length of an
  unattended batch = N, full stop.
- **Swap cycle:** print finishes -> cool-down (parts release from the
  plate as it cools; the Z-Wave outlet metering + a temp threshold say
  when) -> drawer pulls the finished carrier out to the output side ->
  fresh carrier in -> positive seat confirmation before anything moves.
- **Repeatability is the whole problem.** A swapped carrier must land in
  exactly the same plane every time: hard mechanical registration
  (pins/dowel stops, magnetic hold-down), not friction and optimism.
  Per-carrier Z offset stored in Klipper variables, keyed by carrier ID —
  plates are individuals, calibrate each once, file it, done.
- **Scheduler integration:** the swap is the print job's epilog and the
  next job's prolog. Pre-flight gains two checks: carrier present and
  seated (switch/Hall sensor, not camera inference), and carrier ID ==
  manifest's expected carrier class. A failed swap halts the chain with
  the printer safe and the part intact — it never retries blindly.
- **What still gates a truly dark factory, honestly listed:** filament
  (spool capacity + the stock runout sensor pausing for a human),
  nozzle-class changes (batched, Section 3), and magazine capacity N.
  The drawer kills the per-print human step, not physics.
- Fab assumption: drawer rails, stops, and magazine are themselves
  printable + light metalwork — well inside the house's combined
  printed-parts and metal-shop capability, and the drawer prototype is
  itself an early queue job on the 0.4 profile class.

## 9. Open decisions (do not guess these)

1. **G0: Robin's go** on root + Helper Script on his printer. (Owner call.)
2. ~~Nozzle inventory~~ ANSWERED (Eva, 2026-11-26): 0.4 hardened steel on
   hand (plus several others); 0.4 ruby obtainable in 1–3 days via Prime.
   Remaining Phase 1 task is only the exact physical inventory + condition.
3. Filament on hand: multiple types confirmed, and controlled dry storage
   already exists (Creality advanced holder, environmental controls, bought
   with the system). Remaining Phase 1 task: spool-by-spool list + weights.
4. Interim Jenkins/SLURM host until the M70/Forge bring-up lands.
5. ~~Camera~~ ANSWERED (Eva, 2026-11-26): multi-angle is available in-house
   — USB/HDMI webcams, Zowiebox NDI-HX3 (RTSP/RTMP), tripods, PoE
   injectors/splitters. Rig defined in Phase 5. Remaining task is only
   physical placement during Phase 1.

## Sources (verified 2026-11-26)
- K1 family root + Moonraker/Fluidd via Helper Script, port map:
  https://blog.octoeverywhere.com/remote-access-for-the-creality-k1-and-k1-max/
- Obico on K1/K1 Max (root prerequisite, AI failure detection):
  https://www.obico.io/blog/remote-access-creality-k1/
- OrcaSlicer CLI flags and headless invocation:
  https://printago.io/blog/orca-slicer-cli-reference
- K1 camera stream address + Moonraker host type:
  https://help.simplyprint.io/en/article/creality-k1-k1c-k1-max-ke-and-k2-simplyprint-client-or-klipper-and-the-camera-p0bwte/
