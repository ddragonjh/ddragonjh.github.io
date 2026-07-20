(() => {
  const search = document.querySelector('[aria-label="Search fixes"]');
  const language = document.querySelector('[aria-label="Reading language"]');
  const rows = Array.from(document.querySelectorAll('.issue-row'));
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const resultHeading = document.querySelector('[data-result-count]');
  let category = 'All';

  const apply = () => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;
    for (const row of rows) {
      const matchesCategory = category === 'All' || row.dataset.category === category;
      const matchesQuery = !query || (row.textContent || '').toLowerCase().includes(query);
      const show = matchesCategory && matchesQuery;
      row.hidden = !show;
      if (show) visible += 1;
    }
    if (resultHeading) resultHeading.textContent = visible + (visible === 1 ? ' entry' : ' entries');
  };

  search?.addEventListener('input', apply);
  for (const tab of tabs) {
    tab.addEventListener('click', () => {
      category = tab.textContent?.trim() || 'All';
      const indicator = document.querySelector('.category-tab-indicator');
      for (const item of tabs) {
        const active = item === tab;
        item.setAttribute('aria-selected', active ? 'true' : 'false');
        item.tabIndex = active ? 0 : -1;
      }
      if (indicator) tab.appendChild(indicator);
      apply();
    });
  }

  document.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
    if (!['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const current = tabs.indexOf(document.activeElement);
    let next = current < 0 ? 0 : current;
    if (event.key === 'ArrowRight') next = (next + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (next - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    event.preventDefault();
    tabs[next]?.focus();
    tabs[next]?.click();
  });

  language?.addEventListener('change', () => {
    const locale = language.value;
    for (const row of rows) {
      const current = new URL(row.dataset.sourceUrl || row.href, location.origin);
      const sourceUrl = 'https://ddragonjh.github.io' + current.pathname;
      row.dataset.sourceUrl = sourceUrl;
      if (locale === 'en') {
        row.href = sourceUrl;
        row.target = '';
      } else {
        row.href = 'https://translate.google.com/translate?sl=en&tl=' + encodeURIComponent(locale) + '&u=' + encodeURIComponent(sourceUrl);
        row.target = '_blank';
      }
    }
  });

  const diagnosticInput = document.querySelector('#diagnostic-text');
  const diagnosticButton = document.querySelector('.diagnostic-input button');
  const diagnosticResults = document.querySelector('[data-diagnostic-results]');
  const diagnosticData = document.querySelector('#diagnostic-data');

  diagnosticButton?.addEventListener('click', () => {
    if (!diagnosticInput || !diagnosticResults || !diagnosticData) return;
    const input = diagnosticInput.value.trim().toLowerCase();
    let entries = [];
    try { entries = JSON.parse(diagnosticData.textContent || '[]'); } catch { entries = []; }

    const matches = entries.map((entry) => {
      let score = 0;
      const error = entry.error.toLowerCase();
      if (input.includes(error)) score += 60;
      if (input.includes(entry.product.toLowerCase())) score += 14;
      for (const term of entry.terms) {
        const normalized = term.toLowerCase();
        if (normalized.length >= 4 && input.includes(normalized)) score += 18;
      }
      const inputTokens = new Set(input.match(/[a-z0-9_-]{3,}/g) || []);
      const candidateTokens = new Set(
        [entry.product, entry.error, ...entry.terms].join(' ').toLowerCase().match(/[a-z0-9_-]{3,}/g) || []
      );
      for (const token of inputTokens) if (candidateTokens.has(token)) score += 2;
      return { entry, score };
    }).filter((result) => result.score > 3).sort((a, b) => b.score - a.score).slice(0, 5);

    diagnosticResults.replaceChildren();
    if (!matches.length || input.length < 4) {
      const empty = document.createElement('div');
      empty.className = 'diagnostic-empty';
      const title = document.createElement('strong');
      title.textContent = 'No reliable match yet.';
      const note = document.createElement('p');
      note.textContent = 'Keep the first concrete error line and try the main index.';
      const link = document.createElement('a');
      link.href = '/#fix-library';
      link.textContent = 'Browse all fixes';
      empty.append(title, note, link);
      diagnosticResults.append(empty);
      return;
    }

    const eyebrow = document.createElement('p');
    eyebrow.className = 'eyebrow';
    eyebrow.textContent = 'Closest maintained fixes';
    diagnosticResults.append(eyebrow);
    for (const { entry } of matches) {
      const link = document.createElement('a');
      link.href = entry.href;
      const category = document.createElement('small');
      category.textContent = entry.category;
      const title = document.createElement('strong');
      title.textContent = entry.product + ': ' + entry.error;
      const quickFix = document.createElement('span');
      quickFix.textContent = entry.quickFix;
      link.append(category, title, quickFix);
      diagnosticResults.append(link);
    }
  });

  const labRoot = document.querySelector('.debug-lab');
  if (labRoot) {
    const labRules = [
      ['credentials', /(authorization\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/gi, '$1[REDACTED_CREDENTIAL]'],
      ['credentials', /((?:api[_-]?key|access[_-]?key|client[_-]?secret|password|passwd|secret|auth[_-]?token|refresh[_-]?token)\s*[=:]\s*)["']?[^\s,"';]+["']?/gi, '$1[REDACTED_CREDENTIAL]'],
      ['credentials', /([a-z][a-z0-9+.-]*:\/\/[^\s:/]+:)[^\s@/]+@/gi, '$1[REDACTED_PASSWORD]@'],
      ['tokens', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]'],
      ['tokens', /\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_TOKEN]'],
      ['personal data', /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
      ['private paths', /\b[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\[REDACTED_USER]'],
      ['private paths', /\/(?:Users|home)\/[^/\s]+/g, '/home/[REDACTED_USER]'],
    ];

    const hashText = (value) => {
      let hash = 0x811c9dc5;
      for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
      }
      return (hash >>> 0).toString(16).padStart(8, '0').toUpperCase();
    };

    const fingerprintText = (value) => value.toLowerCase()
      .replace(/\b\d{4}-\d{2}-\d{2}[t\s][\d:.+-]+z?\b/g, '[time]')
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/g, '[uuid]')
      .replace(/0x[0-9a-f]+/g, '[address]')
      .replace(/:\d+(?::\d+)?\b/g, ':[line]')
      .replace(/\b\d{5,}\b/g, '[number]')
      .replace(/\s+/g, ' ')
      .trim();

    const sanitize = (input) => {
      let text = input;
      let total = 0;
      for (const [, pattern, replacement] of labRules) {
        text = text.replace(pattern, (...args) => {
          total += 1;
          const match = args[0];
          const capture = args[1];
          return replacement.startsWith('$1')
            ? (capture || '') + replacement.slice(2)
            : replacement;
        });
      }
      return {
        text,
        total,
        fingerprint: 'FX-' + hashText(fingerprintText(text) || 'empty-log'),
      };
    };

    const signatures = (input) => {
      const signal = /\b(error|exception|failed|failure|fatal|denied|forbidden|unauthorized|timeout|timed out|unavailable|refused|not found|out of memory|traceback|panic|segmentation fault|4\d\d|5\d\d)\b/i;
      const found = sanitize(input).text.split(/\r?\n/).map((line) => {
        const normalized = line.trim()
          .replace(/^\[?[\d:T.Z+-]{8,}\]?\s*/, '')
          .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[uuid]')
          .replace(/0x[0-9a-f]+/gi, '[address]')
          .replace(/:\d+(?::\d+)?\b/g, ':[line]')
          .replace(/\b\d{5,}\b/g, '[number]')
          .replace(/\s+/g, ' ').slice(0, 220);
        const marker = normalized.search(/\b(error|exception|failed|failure|fatal|denied|forbidden|unauthorized|timeout|timed out|unavailable|refused|not found|out of memory|traceback|panic|segmentation fault|4\d\d|5\d\d)\b/i);
        return marker > 0 ? normalized.slice(marker) : normalized;
      })
        .filter((line) => line.length >= 4 && signal.test(line));
      return Array.from(new Set(found)).slice(0, 24);
    };

    const labTabs = Array.from(labRoot.querySelectorAll('[data-lab-mode]'));
    const labPanels = Array.from(labRoot.querySelectorAll('[data-lab-panel]'));
    for (const tab of labTabs) {
      tab.addEventListener('click', () => {
        const mode = tab.dataset.labMode;
        for (const item of labTabs) item.setAttribute('aria-selected', item === tab ? 'true' : 'false');
        for (const panel of labPanels) panel.hidden = panel.dataset.labPanel !== mode;
      });
    }

    const rawLog = labRoot.querySelector('#lab-raw-log');
    const sanitizeButton = labRoot.querySelector('[data-lab-action="sanitize"]');
    const sanitizedOutput = labRoot.querySelector('[data-lab-sanitized-output]');
    const fingerprint = labRoot.querySelector('[data-lab-fingerprint]');
    const redactionStatus = labRoot.querySelector('[data-lab-redaction-status]');
    const sanitizeCopy = labRoot.querySelector('[data-lab-panel="sanitize"] .lab-secondary-button');
    rawLog?.addEventListener('input', () => { sanitizeButton.disabled = !rawLog.value.trim(); });
    sanitizeButton?.addEventListener('click', () => {
      const result = sanitize(rawLog.value);
      sanitizedOutput.textContent = result.text;
      fingerprint.textContent = result.fingerprint;
      redactionStatus.textContent = result.total + ' sensitive value' + (result.total === 1 ? '' : 's') + ' replaced.';
      sanitizeCopy.dataset.copyText = result.text;
      sanitizeCopy.disabled = false;
    });

    const beforeLog = labRoot.querySelector('#lab-before-log');
    const afterLog = labRoot.querySelector('#lab-after-log');
    const compareButton = labRoot.querySelector('[data-lab-action="compare"]');
    const syncCompareButton = () => { compareButton.disabled = !beforeLog.value.trim() || !afterLog.value.trim(); };
    beforeLog?.addEventListener('input', syncCompareButton);
    afterLog?.addEventListener('input', syncCompareButton);

    const renderSignatureColumn = (section, items) => {
      section.querySelector('strong').textContent = String(items.length);
      section.querySelectorAll('ul, p').forEach((item) => item.remove());
      if (!items.length) {
        const empty = document.createElement('p');
        empty.textContent = 'None detected.';
        section.append(empty);
        return;
      }
      const list = document.createElement('ul');
      for (const item of items) {
        const row = document.createElement('li');
        row.textContent = item;
        list.append(row);
      }
      section.append(list);
    };

    compareButton?.addEventListener('click', () => {
      const before = signatures(beforeLog.value);
      const after = signatures(afterLog.value);
      const beforeSet = new Set(before.map((line) => line.toLowerCase()));
      const afterSet = new Set(after.map((line) => line.toLowerCase()));
      const groups = [
        before.filter((line) => !afterSet.has(line.toLowerCase())),
        before.filter((line) => afterSet.has(line.toLowerCase())),
        after.filter((line) => !beforeSet.has(line.toLowerCase())),
      ];
      const columns = labRoot.querySelectorAll('.lab-signature-column');
      groups.forEach((items, index) => renderSignatureColumn(columns[index], items));
    });

    const handoffLog = labRoot.querySelector('#lab-handoff-log');
    const handoffButton = labRoot.querySelector('[data-lab-action="handoff"]');
    const handoffOutput = labRoot.querySelector('[data-lab-handoff-output]');
    const handoffCopy = labRoot.querySelector('[data-lab-panel="handoff"] .lab-secondary-button');
    const downloadButton = labRoot.querySelector('[data-lab-action="download"]');
    handoffLog?.addEventListener('input', () => { handoffButton.disabled = !handoffLog.value.trim(); });
    handoffButton?.addEventListener('click', () => {
      const clean = sanitize(handoffLog.value);
      const found = signatures(handoffLog.value);
      const value = (id) => labRoot.querySelector(id).value.trim() || 'Not provided';
      const report = [
        '# Debug handoff', '',
        '- Fingerprint: ' + clean.fingerprint,
        '- Product or service: ' + value('#lab-product'),
        '- Environment: ' + value('#lab-environment'), '',
        '## Expected result', value('#lab-expected'), '',
        '## Last change before the failure', value('#lab-changed'), '',
        '## Detected failure lines',
        ...(found.length ? found.map((line) => '- ' + line) : ['- No clear failure line detected']), '',
        '## Sanitized evidence', '"""text', clean.text.trim() || 'No log supplied', '"""', '',
        'Redactions applied: ' + clean.total + '. Generated locally by Fix Atlas Debug Lab.',
      ].join('\n').replaceAll('"""', String.fromCharCode(96, 96, 96));
      handoffOutput.textContent = report;
      handoffCopy.dataset.copyText = report;
      handoffCopy.disabled = false;
      downloadButton.dataset.downloadText = report;
      downloadButton.disabled = false;
    });

    for (const button of labRoot.querySelectorAll('[data-copy-text]')) {
      button.addEventListener('click', async () => {
        const value = button.dataset.copyText || '';
        if (!value) return;
        await navigator.clipboard.writeText(value);
        const previous = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = previous; }, 1600);
      });
    }

    downloadButton?.addEventListener('click', () => {
      const value = downloadButton.dataset.downloadText || '';
      if (!value) return;
      const url = URL.createObjectURL(new Blob([value], { type: 'text/markdown' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'fix-atlas-debug-handoff.md';
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  
  const sanitizeEvidence = (input) => {
    const rules = [
      [/(authorization\s*:\s*(?:bearer|basic)\s+)[^\s,;]+/gi, '$1[REDACTED_CREDENTIAL]'],
      [/((?:api[_-]?key|access[_-]?key|client[_-]?secret|password|passwd|secret|auth[_-]?token|refresh[_-]?token)\s*[=:]\s*)["']?[^\s,"';]+["']?/gi, '$1[REDACTED_CREDENTIAL]'],
      [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]'],
      [/\b(?:sk-(?:proj-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16})\b/g, '[REDACTED_TOKEN]'],
      [/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]'],
      [/\b[A-Za-z]:\\Users\\[^\\\s]+/g, 'C:\\Users\\[REDACTED_USER]'],
      [/\/(?:Users|home)\/[^/\s]+/g, '/home/[REDACTED_USER]'],
    ];
    let text = input;
    for (const [pattern, replacement] of rules) text = text.replace(pattern, replacement);
    let hash = 0x811c9dc5;
    const normalized = text.toLowerCase()
      .replace(/:\d+(?::\d+)?\b/g, ':[line]')
      .replace(/\b\d{5,}\b/g, '[number]')
      .replace(/\s+/g, ' ').trim() || 'empty-log';
    for (let index = 0; index < normalized.length; index += 1) {
      hash ^= normalized.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193);
    }
    return { text, fingerprint: 'FX-' + (hash >>> 0).toString(16).padStart(8, '0').toUpperCase() };
  };

  const activateCopy = (root, report) => {
    const button = root.querySelector('[data-tool-copy]');
    if (!button) return;
    button.dataset.toolCopy = report;
    button.disabled = false;
  };

  for (const button of document.querySelectorAll('[data-tool-copy]')) {
    button.addEventListener('click', async () => {
      const value = button.dataset.toolCopy || '';
      if (!value) return;
      await navigator.clipboard.writeText(value);
      const previous = button.innerHTML;
      button.textContent = 'Copied';
      setTimeout(() => { button.innerHTML = previous; }, 1600);
    });
  }

  const stackRoot = document.querySelector('[data-stack-tool]');
  if (stackRoot) {
    const input = stackRoot.querySelector('#stack-trace-input');
    const analyze = stackRoot.querySelector('[data-stack-analyze]');
    const clear = stackRoot.querySelector('[data-stack-clear]');
    const example = stackRoot.querySelector('[data-stack-example]');
    const sample = "TypeError: Cannot read properties of undefined (reading 'id')\n    at buildInvoice (C:\\Users\\alex\\project\\src\\billing.ts:47:19)\n    at processOrder (C:\\Users\\alex\\project\\src\\orders.ts:88:11)\n    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)";
    const sync = () => { analyze.disabled = !input.value.trim(); clear.disabled = !input.value; };
    input.addEventListener('input', sync);
    example.addEventListener('click', () => { input.value = sample; sync(); });
    clear.addEventListener('click', () => { input.value = ''; sync(); });
    analyze.addEventListener('click', () => {
      const clean = sanitizeEvidence(input.value);
      const value = clean.text;
      const lines = value.split(/\r?\n/);
      const language = /Traceback \(most recent call last\):/i.test(value) ? 'Python'
        : /^\s*at [\w.$]+\([^)]*\.(?:java|kt):\d+\)/m.test(value) ? 'Java / Kotlin'
        : /System\.[\w.]+Exception/.test(value) ? '.NET'
        : /^goroutine \d+ \[/m.test(value) || /^panic:/m.test(value) ? 'Go'
        : /thread '[^']+' panicked at/.test(value) ? 'Rust'
        : /^\s*at (?:async )?.+\(?[^\s()]+:\d+:\d+\)?/m.test(value) || /(?:TypeError|ReferenceError|SyntaxError|RangeError):/.test(value) ? 'JavaScript / TypeScript'
        : 'Unknown';
      const isFrame = (line) => /^\s*(?:at |File "|#\d+\s|\d+:\s+0x|[\w./\\-]+\.(?:go|rs):\d+)/.test(line);
      const vendor = /(?:node:internal|node_modules|site-packages|\/lib\/(?:python|ruby)|\\lib\\|java\.|javax\.|sun\.|kotlin\.|System\.|Microsoft\.|runtime\/|\/rustc\/|\.cargo\/registry)/i;
      const frames = lines.filter(isFrame);
      const appFrames = frames.filter((line) => !vendor.test(line));
      const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
      let rootCause = nonEmpty.find((line) => !isFrame(line) && /(?:Error|Exception|panic|fatal|failed)/i.test(line)) || nonEmpty[0] || 'No specific exception line detected';
      if (language === 'Java / Kotlin') rootCause = nonEmpty.filter((line) => /^Caused by:/i.test(line)).at(-1)?.replace(/^Caused by:\s*/i, '') || rootCause;
      if (language === 'Python') rootCause = nonEmpty.filter((line) => !isFrame(line) && !/^Traceback|^During handling|^The above exception/i.test(line)).at(-1) || rootCause;
      const frame = appFrames[0]?.trim().replace(/^at\s+/, '') || 'No application-owned frame confidently detected';
      const causes = lines.filter((line) => /^\s*(?:Caused by:|During handling|The above exception)/i.test(line)).length;
      const checks = [
        appFrames.length ? 'Open the first application-owned frame and inspect the values entering that call.' : 'Capture a fuller trace or enable source maps/symbols so application frames are visible.',
        causes ? 'Start with the deepest nested cause before changing the outer wrapper error.' : 'Confirm whether this exception is the first failure or a later consequence.',
        'Reproduce once with the same input, runtime version, and dependency set before applying a change.',
      ];
      stackRoot.querySelector('[data-stack-language]').textContent = language;
      stackRoot.querySelector('[data-stack-root]').textContent = rootCause;
      stackRoot.querySelector('[data-stack-frame]').textContent = frame;
      stackRoot.querySelector('[data-stack-frames]').textContent = String(frames.length);
      stackRoot.querySelector('[data-stack-app-frames]').textContent = String(appFrames.length);
      stackRoot.querySelector('[data-stack-causes]').textContent = String(causes);
      const checkList = stackRoot.querySelector('[data-stack-checks]');
      checkList.replaceChildren(...checks.map((item) => { const row = document.createElement('li'); row.textContent = item; return row; }));
      const report = ['# Stack trace triage', '', '- Fingerprint: ' + clean.fingerprint, '- Detected runtime: ' + language, '- Likely root cause: ' + rootCause, '- First application frame: ' + frame, '- Frames: ' + frames.length + ' total / ' + appFrames.length + ' application-owned', '- Nested cause markers: ' + causes, '', '## Next checks', ...checks.map((item) => '- ' + item), '', '## Sanitized trace', '"""text', clean.text.trim(), '"""', '', 'Generated locally by Fix Atlas. Review redactions before sharing.'].join('\n').replaceAll('"""', String.fromCharCode(96, 96, 96));
      activateCopy(stackRoot, report);
    });
  }

  const dependencyRoot = document.querySelector('[data-dependency-tool]');
  if (dependencyRoot) {
    const before = dependencyRoot.querySelector('#dependency-before');
    const after = dependencyRoot.querySelector('#dependency-after');
    const compare = dependencyRoot.querySelector('[data-dependency-compare]');
    const clear = dependencyRoot.querySelector('[data-dependency-clear]');
    const example = dependencyRoot.querySelector('[data-dependency-example]');
    const goodSample = '{\n  "dependencies": {\n    "next": "15.4.0",\n    "react": "19.1.0",\n    "zod": "3.25.0"\n  }\n}';
    const badSample = '{\n  "dependencies": {\n    "next": "16.0.0",\n    "react": "19.1.0",\n    "undici": "7.12.0"\n  }\n}';
    const sync = () => { compare.disabled = !before.value.trim() || !after.value.trim(); clear.disabled = !before.value && !after.value; };
    before.addEventListener('input', sync); after.addEventListener('input', sync);
    example.addEventListener('click', () => { before.value = goodSample; after.value = badSample; sync(); });
    clear.addEventListener('click', () => { before.value = ''; after.value = ''; sync(); });
    const parse = (input) => {
      const found = new Map();
      try {
        const data = JSON.parse(input);
        for (const group of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
          for (const [name, version] of Object.entries(data[group] || {})) if (typeof version === 'string') found.set(name.toLowerCase(), { name, version });
        }
        if (found.size) return found;
      } catch {}
      for (const raw of input.split(/\r?\n/)) {
        const line = raw.trim().replace(/^[+|\x60\-\\\s]+/, '');
        let match = line.match(/^([A-Za-z0-9_.-]+(?:\[[^\]]+\])?)\s*(===|==|~=|>=|<=|!=|>|<)\s*([^;\s]+)/);
        if (match) { found.set(match[1].toLowerCase(), { name: match[1], version: match[2] + match[3] }); continue; }
        match = line.match(/^(@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+)@([^\s]+)$/) || line.match(/^([A-Za-z0-9_.-]+)\s+([^\s]+)$/);
        if (match && /\d/.test(match[2])) found.set(match[1].toLowerCase(), { name: match[1], version: match[2] });
      }
      return found;
    };
    compare.addEventListener('click', () => {
      const left = parse(before.value); const right = parse(after.value);
      const names = Array.from(new Set([...left.keys(), ...right.keys()])).sort();
      const changes = names.map((key) => {
        const a = left.get(key); const b = right.get(key);
        if (!a) return { name: b.name, before: 'Not installed', after: b.version, kind: 'added', risk: 'review', note: 'New dependency in the failing environment.' };
        if (!b) return { name: a.name, before: a.version, after: 'Not installed', kind: 'removed', risk: 'review', note: 'Dependency present in the known-good environment is missing.' };
        if (a.version === b.version) return { name: b.name, before: a.version, after: b.version, kind: 'unchanged', risk: 'low', note: 'Same declared version.' };
        const av = a.version.match(/(?:^|[^\d])(\d+)\.(\d+)/); const bv = b.version.match(/(?:^|[^\d])(\d+)\.(\d+)/);
        const major = av && bv && Number(av[1]) !== Number(bv[1]);
        return { name: b.name, before: a.version, after: b.version, kind: 'changed', risk: major ? 'high' : 'review', note: major ? 'Major version changed; review compatibility and migration notes.' : 'Version changed; check release notes and the failing boundary.' };
      });
      const count = (kind) => changes.filter((item) => item.kind === kind).length;
      dependencyRoot.querySelector('[data-dependency-changed]').textContent = String(count('changed'));
      dependencyRoot.querySelector('[data-dependency-added]').textContent = String(count('added'));
      dependencyRoot.querySelector('[data-dependency-removed]').textContent = String(count('removed'));
      dependencyRoot.querySelector('[data-dependency-same]').textContent = String(count('unchanged'));
      const output = dependencyRoot.querySelector('[data-dependency-results]');
      output.querySelectorAll('.dependency-row, .tool-empty-result').forEach((item) => item.remove());
      const meaningful = changes.filter((item) => item.kind !== 'unchanged');
      if (!meaningful.length) {
        const empty = document.createElement('div'); empty.className = 'tool-empty-result'; empty.innerHTML = '<strong>No declared dependency drift detected.</strong><p>Compare resolved lockfiles, runtime versions, environment variables, and build flags next.</p>'; output.append(empty);
      }
      for (const item of meaningful) {
        const row = document.createElement('div'); row.className = 'dependency-row'; row.dataset.risk = item.risk;
        const name = document.createElement('strong'); name.textContent = item.name;
        const oldVersion = document.createElement('code'); oldVersion.textContent = item.before;
        const newVersion = document.createElement('code'); newVersion.textContent = item.after;
        const note = document.createElement('p'); const kind = document.createElement('span'); kind.textContent = item.kind; note.append(kind, document.createTextNode(item.note));
        row.append(name, oldVersion, newVersion, note); output.append(row);
      }
      const report = ['# Dependency environment diff', '', '- Known-good packages: ' + left.size, '- Failing packages: ' + right.size, '- Changed: ' + count('changed') + ' / Added: ' + count('added') + ' / Removed: ' + count('removed'), '', '## Investigation candidates', ...(meaningful.length ? meaningful.map((item) => '- [' + item.risk.toUpperCase() + '] ' + item.name + ': ' + item.before + ' -> ' + item.after + '. ' + item.note) : ['- No declared dependency drift detected.']), '', '## Limits', '- Declared ranges can resolve differently across installs; compare lockfiles when exact versions matter.', '', 'Generated locally by Fix Atlas.'].join('\n');
      activateCopy(dependencyRoot, report);
    });
  }

  const httpRoot = document.querySelector('[data-http-tool]');
  if (httpRoot) {
    const method = httpRoot.querySelector('#http-method');
    const input = httpRoot.querySelector('#http-evidence');
    const analyze = httpRoot.querySelector('[data-http-analyze]');
    const clear = httpRoot.querySelector('[data-http-clear]');
    const example = httpRoot.querySelector('[data-http-example]');
    const sample = 'HTTP/1.1 429 Too Many Requests\nContent-Type: application/json\nRetry-After: 30\nX-Request-Id: req_83K19\n\n{"error":"rate limit exceeded"}';
    const sync = () => { analyze.disabled = !input.value.trim(); clear.disabled = !input.value; };
    input.addEventListener('input', sync);
    example.addEventListener('click', () => { method.value = 'GET'; input.value = sample; sync(); });
    clear.addEventListener('click', () => { input.value = ''; sync(); });
    analyze.addEventListener('click', () => {
      const clean = sanitizeEvidence(input.value); const value = clean.text;
      const match = value.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})\b/i) || value.match(/\bstatus(?:Code)?\s*[:=]\s*(\d{3})\b/i) || value.match(/\b(?:response|error)\s+(\d{3})\b/i);
      const status = match ? Number(match[1]) : null;
      const labels = { 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found', 408: 'Request Timeout', 409: 'Conflict', 425: 'Too Early', 429: 'Too Many Requests', 500: 'Internal Server Error', 501: 'Not Implemented', 502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
      const transient = [408, 425, 429, 500, 502, 503, 504].includes(status);
      const permanent = [400, 401, 403, 404, 405, 410, 422, 501].includes(status);
      const repeatable = ['GET', 'HEAD', 'OPTIONS', 'PUT', 'DELETE'].includes(method.value);
      const hasKey = /^(?:idempotency-key|x-idempotency-key)\s*:/im.test(value);
      let decision = 'Insufficient evidence'; let tone = 'unknown'; let reason = 'Add an HTTP status line or status field before deciding whether to retry.';
      if (permanent) { decision = 'Do not retry unchanged'; tone = 'stop'; reason = 'This response usually requires changing credentials, permissions, the URL, or the request payload.'; }
      else if (status === 409) { decision = 'Retry conditionally'; tone = 'conditional'; reason = 'Resolve the conflicting state or add the required precondition before repeating the request.'; }
      else if (transient && (repeatable || hasKey)) { decision = 'Retry automatically'; tone = 'retry'; reason = hasKey ? 'The failure is potentially transient and an idempotency key is present. Preserve the same key across attempts.' : 'The failure is potentially transient and the selected method is designed to be repeatable.'; }
      else if (transient) { decision = 'Retry conditionally'; tone = 'conditional'; reason = 'The response may be transient, but repeating POST or PATCH could duplicate a completed operation. Confirm server state or use an idempotency key.'; }
      else if (status !== null) { decision = 'Do not retry unchanged'; tone = 'stop'; reason = 'The status is not a standard transient retry signal. Inspect the response and change the request before repeating it.'; }
      const retryMatch = value.match(/^Retry-After\s*:\s*(.+)$/im); const retryValue = retryMatch?.[1].trim() || ''; const seconds = /^\d+$/.test(retryValue) ? Number(retryValue) : null;
      const format = (number) => number >= 3600 ? Math.ceil(number / 3600) + 'h' : number >= 60 ? Math.ceil(number / 60) + 'm' : number + 's';
      const wait = seconds !== null ? 'Retry-After requests a minimum wait of ' + format(seconds) + '.' : 'No Retry-After header detected; use capped exponential backoff with jitter only when retrying is otherwise safe.';
      const base = seconds ?? 1; const schedule = ['retry', 'conditional'].includes(tone) ? [0, 1, 2, 3].map((power) => format(base * 2 ** power) + ' + random jitter') : [];
      const statusLabel = status ? status + ' ' + (labels[status] || 'HTTP response') : 'No status detected';
      httpRoot.querySelector('[data-http-status]').textContent = statusLabel;
      httpRoot.querySelector('[data-http-decision]').textContent = decision;
      httpRoot.querySelector('[data-http-reason]').textContent = reason;
      httpRoot.querySelector('[data-http-wait]').textContent = wait;
      httpRoot.querySelector('.retry-verdict').dataset.tone = tone;
      const list = httpRoot.querySelector('[data-http-schedule]'); const rows = schedule.length ? schedule : ['No automatic attempts recommended yet.'];
      list.replaceChildren(...rows.map((item) => { const row = document.createElement('li'); row.textContent = item; return row; }));
      const report = ['# HTTP retry decision', '', '- Fingerprint: ' + clean.fingerprint, '- Request: ' + method.value, '- Response: ' + statusLabel, '- Decision: ' + decision, '', '## Reason', reason, '', '## Server timing signal', wait, ...(schedule.length ? ['', '## Candidate schedule', ...schedule.map((item, index) => '- Attempt ' + (index + 2) + ': ' + item)] : []), '', '## Sanitized evidence', '"""text', clean.text.trim(), '"""', '', 'Generated locally by Fix Atlas. Confirm provider-specific retry and idempotency rules.'].join('\n').replaceAll('"""', String.fromCharCode(96, 96, 96));
      activateCopy(httpRoot, report);
    });
  }
  
})();