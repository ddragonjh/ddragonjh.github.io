(() => {
  const search = document.querySelector('[aria-label="Search fixes"]');
  const language = document.querySelector('[aria-label="Reading language"]');
  const cards = Array.from(document.querySelectorAll('.directory-item'));
  const chips = Array.from(document.querySelectorAll('.category-chip'));
  const resultHeading = document.querySelector('#fix-library h2');
  let category = 'All';

  const apply = () => {
    const query = (search?.value || '').trim().toLowerCase();
    let visible = 0;
    for (const card of cards) {
      const cardCategory = card.querySelector('.directory-meta span')?.textContent?.trim() || '';
      const matchesCategory = category === 'All' || cardCategory === category;
      const matchesQuery = !query || (card.textContent || '').toLowerCase().includes(query);
      const show = matchesCategory && matchesQuery;
      card.hidden = !show;
      if (show) visible += 1;
    }
    if (resultHeading) resultHeading.textContent = visible + (visible === 1 ? ' result' : ' results');
  };

  search?.addEventListener('input', apply);
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      category = chip.textContent?.trim() || 'All';
      for (const item of chips) item.classList.toggle('active', item === chip);
      apply();
    });
  }

  language?.addEventListener('change', () => {
    const locale = language.value;
    for (const card of cards) {
      const current = new URL(card.dataset.sourceUrl || card.href, location.origin);
      const sourceUrl = 'https://ddragonjh.github.io' + current.pathname;
      card.dataset.sourceUrl = sourceUrl;
      if (locale === 'en') {
        card.href = sourceUrl;
        card.target = '';
      } else {
        card.href = 'https://translate.google.com/translate?sl=en&tl=' + encodeURIComponent(locale) + '&u=' + encodeURIComponent(sourceUrl);
        card.target = '_blank';
      }
    }
  });
})();