export const NAV_ORDER_STORAGE_KEY = "jellyglance_nav_order";
export const NAV_HIDDEN_STORAGE_KEY = "jellyglance_nav_hidden";
export const LOCKED_NAV_LINKS = new Set(["", "settings", "about"]);

export function getDefaultReorderableNavLinks(navItems = []) {
  return navItems.filter((item) => !LOCKED_NAV_LINKS.has(item.link)).map((item) => item.link);
}

export function getStoredNavOrder(navItems = []) {
  const defaultOrder = getDefaultReorderableNavLinks(navItems);

  try {
    const parsed = JSON.parse(localStorage.getItem(NAV_ORDER_STORAGE_KEY) || "[]");
    const savedOrder = Array.isArray(parsed) ? parsed.filter((link) => defaultOrder.includes(link)) : [];
    return [...savedOrder, ...defaultOrder.filter((link) => !savedOrder.includes(link))];
  } catch {
    return defaultOrder;
  }
}

export function saveNavOrder(order = [], navItems = []) {
  const defaultOrder = getDefaultReorderableNavLinks(navItems);
  const nextOrder = [...order.filter((link) => defaultOrder.includes(link)), ...defaultOrder.filter((link) => !order.includes(link))];
  localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(nextOrder));
  window.dispatchEvent(new CustomEvent("jellyglance-nav-order-updated", { detail: nextOrder }));
  return nextOrder;
}

export function resetNavOrder() {
  localStorage.removeItem(NAV_ORDER_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("jellyglance-nav-order-updated"));
}

export function getStoredHiddenNavLinks(navItems = []) {
  const hideableLinks = new Set(navItems.filter((item) => !LOCKED_NAV_LINKS.has(item.link)).map((item) => item.link));

  try {
    const parsed = JSON.parse(localStorage.getItem(NAV_HIDDEN_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((link) => hideableLinks.has(link)) : [];
  } catch {
    return [];
  }
}

export function saveHiddenNavLinks(hiddenLinks = [], navItems = []) {
  const hideableLinks = new Set(navItems.filter((item) => !LOCKED_NAV_LINKS.has(item.link)).map((item) => item.link));
  const nextHiddenLinks = [...new Set(hiddenLinks.filter((link) => hideableLinks.has(link)))];
  localStorage.setItem(NAV_HIDDEN_STORAGE_KEY, JSON.stringify(nextHiddenLinks));
  window.dispatchEvent(new CustomEvent("jellyglance-nav-visibility-updated", { detail: nextHiddenLinks }));
  return nextHiddenLinks;
}

export function resetHiddenNavLinks() {
  localStorage.removeItem(NAV_HIDDEN_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("jellyglance-nav-visibility-updated", { detail: [] }));
}

export function applyNavOrder(navItems = [], order = getStoredNavOrder(navItems)) {
  const orderMap = new Map(order.map((link, index) => [link, index]));
  const homeItems = navItems.filter((item) => item.link === "");
  const settingsItems = navItems.filter((item) => item.link === "settings");
  const aboutItems = navItems.filter((item) => item.link === "about");
  const middleItems = navItems
    .filter((item) => !LOCKED_NAV_LINKS.has(item.link))
    .sort((first, second) => {
      const firstOrder = orderMap.has(first.link) ? orderMap.get(first.link) : Number.MAX_SAFE_INTEGER;
      const secondOrder = orderMap.has(second.link) ? orderMap.get(second.link) : Number.MAX_SAFE_INTEGER;
      return firstOrder - secondOrder || first.id - second.id;
    });

  return [...homeItems, ...middleItems, ...settingsItems, ...aboutItems];
}
