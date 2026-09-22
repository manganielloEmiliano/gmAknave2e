const routes = new Map();
let outletEl = null;

export function registerRoute(path, renderFn) {
  routes.set(path, renderFn);
}

export function currentPath() {
  const hash = window.location.hash.slice(1);
  return hash || "/";
}

export function navigate(path) {
  if (currentPath() === path) {
    renderCurrent();
  } else {
    window.location.hash = path;
  }
}

function renderCurrent() {
  if (!outletEl) return;
  const path = currentPath();
  const renderFn = routes.get(path) || routes.get("/");
  outletEl.innerHTML = "";
  renderFn(outletEl);
}

export function startRouter(outlet) {
  outletEl = outlet;
  window.addEventListener("hashchange", renderCurrent);
  renderCurrent();
}
