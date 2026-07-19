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
})();