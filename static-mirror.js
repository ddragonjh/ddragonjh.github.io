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
})();