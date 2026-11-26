# Submission draft - prepared 2026-11-24, rules TBC

Working title: The Human Neuro-Endocrine System - one looped system

One-liner: An interactive 3D model of the human neuro-endocrine
system as what it actually is - a looped matrice of causally
dependent feedback systems - with a programmer's field guide to
what coffee and chocolate do at every node.

Description (draft):
Endocrine diagrams are usually drawn as flowcharts: gland, arrow,
hormone, done. Real physiology is a control system. This project
rebuilds the hypothalamus-pituitary hub and its three axes (HPT,
HPA, HPG) as a rotating 3D scene driven entirely by a data file:
nodes, axes, feedback edges, and a decoupling lesson - decouple
one node and the failure is never local, because every link is a
loop. The second half is the hook every programmer already lives:
coffee pushes the system (adenosine blockade, ACTH up 20-50% at
30-60 minutes, D2/D3 disinhibition) and chocolate brakes it
(FAAH/anandamide stress buffering, 11beta-HSD1 inhibition) - a
toggleable sheet shows the effect of each at all ten nodes,
including the honest rows where the answer is "not affected".

Built from scratch: model-as-data JSON, a single-file Three.js
viewer with the library vendored (runs fully offline), flowing
signal particles, three simulation modes including a decoupling
cascade, a unified semantic color palette, zero third-party
model code.

Needs before submission (fill in when the challenge rules land):
- [ ] Which challenge + confirmation the enrollment covers this
- [ ] Required build tooling / budget rules, if any
- [ ] Hosting target and submission format
- [ ] Team attribution line (Eva + Robin, as enrolled)

Status against the verified Ember hackathon rules (checked
2026-11-24/25; submission by Dec 2, 21:00 ET, via the Cerebral
Valley portal):
- [x] Public GitHub repository - em-winterschon/neural-research-networks
- [x] AI functionality on Muse Ember via the Meta Model API -
  "Explain this state" panel (ember.js; model muse-ember-1.0;
  direct key mode or proxy.py). See EMBER.md.
- [ ] Prompt/token trace - the panel and proxy generate it
  (ember-trace.json / ember-trace.jsonl); first real trace is
  produced by running one Explain call with a funded key.
- [ ] 3-minute demo video
- [ ] Eligibility confirmation (solo-only, US-located) against
  the actual enrollment
