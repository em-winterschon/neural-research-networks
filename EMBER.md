# Ember feature - "Explain this state"

The viewer's AI feature. A panel (bottom-left, "Explain this
state - Muse Ember") sends the live simulation state to Muse
Ember on the Meta Model API and explains it back in plain
language.

## What gets sent

Only the public model's own data, serialized at click time:

- current simulation mode (id, name, system balance, summary)
- the focused node, if any (name, kind, detail, its connections
  and the signals they carry, its coffee/chocolate effects row)
- broken links (Decoupled mode)
- which pathways are currently visible
- playback speed

No personal data exists in this project and none is sent. The
system prompt instructs the model to explain only the given
state, not to invent nodes or mechanisms, and to give no medical
advice.

## The call

- Endpoint: POST https://api.meta.ai/v1/chat/completions
- Model: muse-ember-1.0 (Muse Ember, Standard mode)
- Auth: Bearer MODEL_API_KEY (Meta Model API key)
- Body: OpenAI-compatible chat completions; output capped with
  max_tokens (600), which is how the Meta API takes the cap.

## Two connection modes

Direct (default in the panel): the browser calls api.meta.ai
with a key pasted into the panel. The key is held in
sessionStorage only - it dies with the tab, is never written to
disk, and is sent nowhere except api.meta.ai.

Proxy: run the local server and pick "Local proxy" in the panel.

    MODEL_API_KEY=... python3 proxy.py 8000
    # open http://localhost:8000

proxy.py (standard library only) serves the viewer, forwards
POST /api/chat to the Meta API with the key from its
environment, and appends every call to ember-trace.jsonl.

## The trace

Every call - success or failure - is recorded with its full
prompt (system + user), the simulation mode and focused node,
the response id and model, the token usage the API returns
(prompt / completion / total), the HTTP status, and latency.

- In the panel: running call count and token total, per-call
  rows, and a "Download trace JSON" button (ember-trace.json).
- Via the proxy: the same data accumulates server-side in
  ember-trace.jsonl.

The trace is the artifact that proves Ember usage and token
spend for the submission. The viewer itself runs fully offline
with no key; only this panel needs the network.
