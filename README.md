# The Human Neuro-Endocrine System - an interactive model

The human neuro-endocrine system drawn the way it actually works:
one looped matrice of causally dependent systems that rely on
homeostasis to remain balanced. A hypothalamus that reads dopamine
expression and delegates to a pituitary hub; three hormone axes
(HPT, HPA, HPG) whose plants report back on every link; a conversion
step in the liver and kidney that the whole thyroid loop depends on;
and a decoupling lesson - in a looped system, no failure is local.

Built as an interactive, rotational 3D page (Three.js) with a
programmer's field guide to what coffee and chocolate actually do
to the axes.

## Contents

- model-data.json - the model as data: nodes, axes, edges,
  pathways, the decoupling note, and the coffee/chocolate intake
  module. Colors follow a unified semantic palette (dark
  background #0B0E13; one role, one color).
- index.html - single-file rotational viewer (v2): turntable
  rotation and orbit controls; clickable HTML pill labels; signal
  particles flowing along curved pathways; three simulation modes
  (Homeostasis / Stressed - the coffee push / Decoupled - a loop
  breaks) with state badge, system balance bar, mode summary and
  playback speed; per-pathway visibility filters; camera presets
  (Overview / Axis Hub / Top Matrix); a node inspector with
  connection list and focus dimming; broken links in Decoupled
  mode are marked with pulsing red X markers; plus the toggleable
  node-by-node coffee x chocolate effects sheet. All content -
  including sim modes and broken-edge definitions - renders from
  model-data.json.
- preview.png / preview-decoupled.png / preview-effects.png -
  verified renders (2026-11-24).
- ember.js + proxy.py + EMBER.md - the "Explain this state"
  panel: sends the live simulation state to Muse Ember
  (Meta Model API, muse-ember-1.0) and explains it back, with
  a full prompt/token trace. See EMBER.md.

## Run

    python3 -m http.server 8000
    # open http://localhost:8000

(Three.js r160 is vendored under vendor/ - MIT licence,
(c) Three.js Authors - so the page runs fully offline.)

For the Ember panel, either paste a Model API key into the
panel (direct mode), or serve through the proxy with the key
in its environment:

    MODEL_API_KEY=... python3 proxy.py 8000

## Status

Staged 2026-11-24; v2 same day. Data validated as JSON; viewer
script syntax-checked; visual renders verified headlessly
2026-11-24 (scene, labels, particles, sim-mode switching with
badge/balance/X markers, and the 10-row effects sheet all render
from the data file with zero page errors).
