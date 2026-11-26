// ember.js - "Explain this state" panel for the neuro-endocrine viewer.
//
// The panel takes the viewer's live simulation state (current mode,
// focused node, broken links, visible pathways) and asks Muse Ember
// (Meta Model API, model muse-ember-1.0) to explain it in plain
// language. Every call is recorded in a prompt/token trace that can
// be downloaded as JSON - the trace is the submission artifact that
// proves Ember usage and token spend.
//
// Two ways to reach the API:
//   direct - the browser calls https://api.meta.ai/v1/chat/completions
//            with a Model API key pasted into the panel. The key is
//            held in sessionStorage only: it dies with the tab, is
//            never written to disk, and is sent nowhere except
//            api.meta.ai.
//   proxy  - the browser POSTs to ./api/chat and proxy.py forwards
//            the request with MODEL_API_KEY from its environment.
//            Use this when the browser is blocked (e.g. CORS) or the
//            key must stay off the client entirely.
//
// The viewer itself stays fully functional with no key and no
// network: this file only adds the panel.

(function () {
  'use strict';

  var API_URL = 'https://api.meta.ai/v1/chat/completions';
  var PROXY_URL = './api/chat';
  var MODEL = 'muse-ember-1.0';
  var KEY_SLOT = 'ember_model_api_key';

  var SYSTEM_PROMPT = [
    'You explain an interactive 3D model of the human neuro-endocrine system',
    'to a scientifically literate viewer. The model treats the system as one',
    'looped matrice of causally dependent feedback loops: a hypothalamus and',
    'pituitary hub, three hormone axes (HPT, HPA, HPG), and feedback on every',
    'link, so no failure is local.',
    '',
    'You are given the exact current state of the simulation as JSON. Explain',
    'that state - and only that state - in plain, precise language:',
    '- what the current mode means for the whole loop,',
    '- if a node is focused, what that node does, what its listed connections',
    '  carry, and what changes for it in this mode,',
    '- if links are broken, what the break does downstream,',
    '- if coffee/chocolate effects are given for the focused node, fold them in.',
    'Do not invent nodes, hormones, values, or mechanisms that are not in the',
    'state. No medical advice, no diagnosis, no treatment suggestions. Keep it',
    'under 220 words, in short paragraphs. Plain hyphens only.'
  ].join('\n');

  var stateProvider = null;
  var trace = [];
  var els = {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function injectStyle() {
    var css = [
      '#ember-toggle { position:fixed; left:16px; bottom:16px; z-index:6;',
      '  background:#141A22; color:#37C8E8; border:1px solid #37C8E8; border-radius:20px;',
      '  padding:8px 18px; font-size:13.5px; cursor:pointer;',
      '  font-family:"Segoe UI", system-ui, -apple-system, sans-serif; }',
      '#ember-toggle:hover { background:#1C2531; }',
      '#ember-panel { position:fixed; left:16px; bottom:64px; z-index:6; width:348px;',
      '  max-width:94vw; max-height:72vh; overflow-y:auto; display:none;',
      '  background:rgba(13,17,23,.97); border:1px solid #3A4656; border-radius:10px;',
      '  padding:14px 16px; color:#E6EDF3;',
      '  font-family:"Segoe UI", system-ui, -apple-system, sans-serif; scrollbar-width:thin; }',
      '#ember-panel.open { display:block; }',
      '#ember-panel h2 { margin:0 0 2px; font-size:15px; color:#37C8E8; }',
      '#ember-panel p.sub { margin:0 0 10px; color:#93A5B8; font-size:12px; line-height:1.45; }',
      '#ember-panel label { display:block; font-size:11.5px; letter-spacing:.6px;',
      '  color:#C7D0DB; margin:9px 0 4px; }',
      '#ember-panel select, #ember-panel input { width:100%; box-sizing:border-box;',
      '  background:#10151C; color:#E6EDF3; border:1px solid #3A4656; border-radius:7px;',
      '  padding:6px 8px; font-size:12.5px; font-family:inherit; }',
      '#ember-panel .note { font-size:11px; color:#93A5B8; margin-top:4px; line-height:1.4; }',
      '#ember-go { margin-top:11px; width:100%; background:#10151C; color:#37C8E8;',
      '  border:1px solid #37C8E8; border-radius:8px; padding:8px 10px; font-size:13px;',
      '  cursor:pointer; font-family:inherit; }',
      '#ember-go:disabled { opacity:.45; cursor:default; }',
      '#ember-go:hover:not(:disabled) { background:#1C2531; }',
      '#ember-status { font-size:12px; color:#F59E42; margin-top:8px; min-height:15px; }',
      '#ember-answer { font-size:13px; color:#C7D0DB; line-height:1.55; margin-top:6px;',
      '  white-space:pre-wrap; }',
      '#ember-trace-head { display:flex; justify-content:space-between; align-items:baseline;',
      '  margin-top:14px; border-top:1px solid #232D3A; padding-top:10px; }',
      '#ember-trace-head h3 { margin:0; font-size:11.5px; letter-spacing:1.2px; color:#C7D0DB; }',
      '#ember-totals { font-size:11.5px; color:#7FE8A8; }',
      '#ember-trace-list { font-size:11.5px; color:#93A5B8; margin-top:6px; line-height:1.5; }',
      '#ember-trace-list .row { border-bottom:1px solid #1A222D; padding:4px 0; }',
      '#ember-trace-list .err { color:#FF5A3C; }',
      '#ember-panel .rowbtns { display:flex; gap:6px; margin-top:9px; }',
      '#ember-panel .rowbtns button { flex:1; background:#10151C; color:#C7D0DB;',
      '  border:1px solid #3A4656; border-radius:7px; padding:5px 8px; font-size:11.5px;',
      '  cursor:pointer; font-family:inherit; }',
      '#ember-panel .rowbtns button:hover { color:#E6EDF3; }'
    ].join('\n');
    var s = el('style');
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildPanel() {
    var toggle = el('button', null, 'Explain this state - Muse Ember');
    toggle.id = 'ember-toggle';
    toggle.type = 'button';

    var panel = el('div');
    panel.id = 'ember-panel';
    panel.innerHTML =
      '<h2>Explain this state</h2>' +
      '<p class="sub">Sends the live simulation state (mode, focused node, ' +
      'broken links, visible pathways) to Muse Ember on the Meta Model API ' +
      'and explains it back. Every call is logged in the token trace below.</p>';

    var modeLabel = el('label', null, 'CONNECTION');
    var modeSel = el('select');
    modeSel.innerHTML =
      '<option value="direct">Direct - API key in this browser</option>' +
      '<option value="proxy">Local proxy - ./api/chat (proxy.py)</option>';

    var keyLabel = el('label', null, 'MODEL API KEY');
    var keyInput = el('input');
    keyInput.type = 'password';
    keyInput.placeholder = 'MODEL_API_KEY';
    keyInput.autocomplete = 'off';
    try { keyInput.value = sessionStorage.getItem(KEY_SLOT) || ''; } catch (e) { /* private mode */ }
    keyInput.addEventListener('input', function () {
      try { sessionStorage.setItem(KEY_SLOT, keyInput.value); } catch (e) { /* ignore */ }
    });
    var keyNote = el('div', 'note',
      'Session only: kept in this tab, never saved to disk, sent only to api.meta.ai.');

    var go = el('button', null, 'Explain this state');
    go.id = 'ember-go';
    go.type = 'button';
    go.addEventListener('click', explain);

    var status = el('div'); status.id = 'ember-status';
    var answer = el('div'); answer.id = 'ember-answer';

    var traceHead = el('div'); traceHead.id = 'ember-trace-head';
    var traceTitle = el('h3', null, 'PROMPT / TOKEN TRACE');
    var totals = el('span'); totals.id = 'ember-totals'; totals.textContent = '0 calls - 0 tokens';
    traceHead.appendChild(traceTitle); traceHead.appendChild(totals);
    var traceList = el('div'); traceList.id = 'ember-trace-list';
    traceList.textContent = 'No calls yet.';

    var btns = el('div', 'rowbtns');
    var dl = el('button', null, 'Download trace JSON'); dl.type = 'button';
    dl.addEventListener('click', downloadTrace);
    var clear = el('button', null, 'Clear trace'); clear.type = 'button';
    clear.addEventListener('click', function () { trace = []; renderTrace(); });
    btns.appendChild(dl); btns.appendChild(clear);

    panel.appendChild(modeLabel); panel.appendChild(modeSel);
    panel.appendChild(keyLabel); panel.appendChild(keyInput); panel.appendChild(keyNote);
    panel.appendChild(go); panel.appendChild(status); panel.appendChild(answer);
    panel.appendChild(traceHead); panel.appendChild(traceList); panel.appendChild(btns);

    toggle.addEventListener('click', function () { panel.classList.toggle('open'); });
    modeSel.addEventListener('change', function () {
      var proxy = modeSel.value === 'proxy';
      keyInput.disabled = proxy;
      keyNote.textContent = proxy
        ? 'Proxy mode: proxy.py holds the key in its MODEL_API_KEY environment variable.'
        : 'Session only: kept in this tab, never saved to disk, sent only to api.meta.ai.';
    });

    document.body.appendChild(toggle);
    document.body.appendChild(panel);
    els = { modeSel: modeSel, keyInput: keyInput, go: go, status: status,
            answer: answer, totals: totals, traceList: traceList };
  }

  function snapshotState() {
    if (!stateProvider) return null;
    try { return stateProvider(); } catch (e) { return null; }
  }

  function buildUserPrompt(s) {
    var lines = [];
    lines.push('Current simulation state (JSON):');
    lines.push(JSON.stringify(s, null, 1));
    lines.push('');
    lines.push('Explain this state now, following the rules in the system prompt.');
    return lines.join('\n');
  }

  function setStatus(text) { if (els.status) els.status.textContent = text || ''; }

  function explain() {
    var s = snapshotState();
    if (!s) { setStatus('Viewer state not ready yet - try again in a moment.'); return; }
    var viaProxy = els.modeSel.value === 'proxy';
    var key = (els.keyInput.value || '').trim();
    if (!viaProxy && !key) { setStatus('Paste a Model API key first, or switch to proxy mode.'); return; }

    var userPrompt = buildUserPrompt(s);
    var body = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 600
    };

    els.go.disabled = true;
    setStatus('Asking Muse Ember...');
    var started = performance.now();

    var ctrl = ('AbortController' in window) ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;

    var headers = { 'Content-Type': 'application/json' };
    if (!viaProxy) headers['Authorization'] = 'Bearer ' + key;

    fetch(viaProxy ? PROXY_URL : API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (resp) {
      return resp.text().then(function (text) { return { resp: resp, text: text }; });
    }).then(function (r) {
      if (timer) clearTimeout(timer);
      var latency = Math.round(performance.now() - started);
      var entry = {
        ts: new Date().toISOString(),
        model_requested: MODEL,
        endpoint: viaProxy ? 'proxy ./api/chat -> ' + API_URL : API_URL,
        http_status: r.resp.status,
        latency_ms: latency,
        sim_mode: s.mode ? s.mode.id : null,
        focused_node: s.focused ? s.focused.name : null,
        request: { system: SYSTEM_PROMPT, user: userPrompt },
        status: 'error', usage: null, response_id: null, model_returned: null,
        response_text: null, error: null
      };
      var json = null;
      try { json = JSON.parse(r.text); } catch (e) { /* non-JSON body */ }
      if (r.resp.ok && json && json.choices && json.choices[0] &&
          json.choices[0].message && typeof json.choices[0].message.content === 'string') {
        entry.status = 'ok';
        entry.response_id = json.id || null;
        entry.model_returned = json.model || null;
        entry.usage = json.usage || null;
        entry.response_text = json.choices[0].message.content;
        els.answer.textContent = entry.response_text;
        setStatus('');
      } else {
        var detail = json && json.error && json.error.message ? json.error.message
          : (r.text || '').slice(0, 300);
        entry.error = 'HTTP ' + r.resp.status + (detail ? ': ' + detail : '');
        setStatus('Ember call failed - ' + entry.error +
          (viaProxy ? '' : ' If the browser blocked the call, run proxy.py and use proxy mode.'));
      }
      trace.push(entry);
      renderTrace();
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      var latency = Math.round(performance.now() - started);
      trace.push({
        ts: new Date().toISOString(), model_requested: MODEL,
        endpoint: viaProxy ? 'proxy ./api/chat -> ' + API_URL : API_URL,
        http_status: null, latency_ms: latency,
        sim_mode: s.mode ? s.mode.id : null,
        focused_node: s.focused ? s.focused.name : null,
        request: { system: SYSTEM_PROMPT, user: userPrompt },
        status: 'error', usage: null, response_id: null, model_returned: null,
        response_text: null,
        error: String(err && err.message ? err.message : err)
      });
      renderTrace();
      setStatus('Ember call failed - ' + String(err && err.message ? err.message : err) +
        (viaProxy ? '' : ' If the browser blocked the call, run proxy.py and use proxy mode.'));
    }).then(function () { els.go.disabled = false; });
  }

  function renderTrace() {
    if (!els.traceList) return;
    var calls = trace.length;
    var tokens = 0;
    trace.forEach(function (t) { if (t.usage && t.usage.total_tokens) tokens += t.usage.total_tokens; });
    els.totals.textContent = calls + (calls === 1 ? ' call' : ' calls') + ' - ' + tokens + ' tokens';
    if (!calls) { els.traceList.textContent = 'No calls yet.'; return; }
    els.traceList.innerHTML = '';
    trace.slice().reverse().forEach(function (t) {
      var row = el('div', 'row' + (t.status === 'error' ? ' err' : ''));
      var tok = t.usage ? ('in ' + (t.usage.prompt_tokens || 0) +
        ' / out ' + (t.usage.completion_tokens || 0) +
        ' / total ' + (t.usage.total_tokens || 0)) : 'no usage returned';
      row.textContent = t.ts.slice(11, 19) + ' - ' + (t.sim_mode || '?') +
        (t.focused_node ? ' - ' + t.focused_node : '') + ' - ' +
        (t.status === 'ok' ? tok : 'ERROR ' + (t.error || '')) +
        ' - ' + t.latency_ms + ' ms';
      els.traceList.appendChild(row);
    });
  }

  function downloadTrace() {
    var payload = {
      app: 'human-neuro-endocrine-system',
      feature: 'explain-this-state',
      model: MODEL,
      api: API_URL,
      generated_at: new Date().toISOString(),
      calls: trace.length,
      total_tokens: trace.reduce(function (a, t) {
        return a + (t.usage && t.usage.total_tokens ? t.usage.total_tokens : 0);
      }, 0),
      trace: trace
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ember-trace.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 400);
  }

  function init() {
    injectStyle();
    buildPanel();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.EmberPanel = {
    registerStateProvider: function (fn) { stateProvider = fn; },
    getTrace: function () { return trace.slice(); }
  };
})();
