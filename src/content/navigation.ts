/**
 * Avisa quando a URL muda sem recarregar a página (Instagram e X são SPAs).
 * Combina a Navigation API (quando existe) com popstate e uma checagem leve, para não depender de um só caminho.
 */
export function onNavigate(callback: () => void): void {
  let last = location.href;
  const check = () => {
    if (location.href === last) return;
    last = location.href;
    callback();
  };
  (window as unknown as { navigation?: EventTarget }).navigation?.addEventListener('navigate', () => setTimeout(check, 0));
  window.addEventListener('popstate', check);
  setInterval(check, 500);
}

/** Aplica/remove um <style> com id fixo. */
export function setStyle(id: string, css: string | null): void {
  document.getElementById(id)?.remove();
  if (css === null) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.documentElement.appendChild(style);
}
