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
})();