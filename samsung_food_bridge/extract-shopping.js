// Read the selected list's rendered items. Reject incomplete or changed markup.
() => {
  const title = document.querySelector('h1[data-testid="193a848d-e874-b557-3af4-24c082e93808"]')?.textContent?.trim();
  const links = [...document.querySelectorAll('a[data-testid="shopping-lists-list"]')];
  const selected = links.filter(link =>
    link.querySelector('[data-testid="shopping-lists-list-name"]')?.textContent?.trim() === title);
  if (!title || selected.length !== 1) throw Error('shopping_list_unrecognized');
  const path = selected[0].getAttribute('href');
  const countText = selected[0].querySelector('[data-testid="shopping-lists-list-count"]')?.textContent?.trim();
  const countMatch = countText?.match(/^(\d+) items?$/);
  if (!/^\/shopping-list\/[a-zA-Z0-9-]+$/.test(path || '') || !countMatch) {
    throw Error('shopping_list_metadata_changed');
  }
  const container = document.querySelector('[data-testid="35ab9c4d-c210-c93e-ca53-21ef25562452"]');
  if (!container) throw Error('shopping_list_not_loaded');
  const items = [...container.querySelectorAll('[data-testid="shopping-list-item"]')].map(row => {
    const name = row.querySelector('[data-testid="shopping-list-item-name"]')?.textContent?.trim();
    const quantity = row.querySelector('[data-testid="shopping-list-item-quantity-unit"]')?.textContent?.trim() || '';
    const checkbox = row.querySelector('input[type="checkbox"]');
    if (!name || !checkbox || name.length > 500 || quantity.length > 300) {
      throw Error('shopping_item_structure_changed');
    }
    return {name, quantity, completed: checkbox.checked};
  });
  const expected = Number(countMatch[1]);
  const remaining = items.filter(item => !item.completed).length;
  if (expected !== items.length && expected !== remaining) throw Error('shopping_list_incomplete');
  return {name: title, source_url: 'https://app.samsungfood.com' + path, items};
}
