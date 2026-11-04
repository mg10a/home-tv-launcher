// Reads rendered DOM only. Fail closed when the observed website structure changes.
() => {
  const DAYS = '488a6f56-583c-ee62-d353-df8debed9e3f';
  const CARDS = '40c2d572-ab58-99ea-b8a6-173d9155b935';
  const TITLE = '97509c46-e691-f136-b754-240e722b3039';
  const SLOT = '6022d372-a99e-2a0e-10cd-56e57234be3e';
  const days = [];
  for (const group of document.querySelectorAll(`[data-testid="${DAYS}"]`)) {
    const link = group.querySelector('a[href*="/day/"]');
    const match = link?.getAttribute('href')?.match(/\/day\/(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (!match) throw Error('day_structure_changed');
    const date = `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}`;
    const meals = [...group.querySelectorAll(`[data-testid="${CARDS}"]`)].map(card => {
      const title = card.querySelector(`[data-testid="${TITLE}"]`)?.textContent?.trim();
      const slot = card.querySelector(`[data-testid="${SLOT}"]`)?.textContent?.trim();
      if (!title || !slot) throw Error('meal_structure_changed');
      return {title: title.slice(0,300), slot: slot.slice(0,40)};
    });
    // Nonempty content without recognized cards must not erase yesterday's data.
    const body = group.children[1];
    if (body?.textContent?.trim() && !meals.length) throw Error('unrecognized_meals');
    days.push({date, meals});
  }
  if (days.length !== 7 || new Set(days.map(d=>d.date)).size !== 7) throw Error('week_incomplete');
  return days;
}
