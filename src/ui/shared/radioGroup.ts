/**
 * Grupo de escolha única acessível (role="radiogroup" com botões role="radio").
 *
 * - Só a opção marcada entra no Tab (tabindex itinerante); sem nenhuma marcada, a primeira.
 * - Setas (←↑ / →↓), Home e End movem o foco entre as opções.
 * - `selectOnMove`: como num rádio comum, mover já escolhe. Use `false` quando escolher tem efeito imediato
 *   (grava a rotina, pode pedir fricção): aí a seta só move o foco e Espaço/Enter escolhe.
 */
const KEYS = new Set(['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']);

/** Índice da próxima opção para a tecla (com volta ao início/fim), ou null se a tecla não é de navegação. */
export function nextRadioIndex(key: string, current: number, count: number): number | null {
  if (!KEYS.has(key) || count === 0) return null;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  const step = key === 'ArrowRight' || key === 'ArrowDown' ? 1 : -1;
  const from = current < 0 ? (step > 0 ? -1 : count) : current;
  return (from + step + count) % count;
}

export function radioKeys(selectOnMove = true) {
  return (e: KeyboardEvent) => {
    const group = e.currentTarget as HTMLElement;
    const radios = [...group.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
    const next = nextRadioIndex(e.key, radios.indexOf(document.activeElement as HTMLElement), radios.length);
    if (next === null) return;
    const target = radios[next];
    if (!target) return;
    e.preventDefault();
    target.focus();
    if (selectOnMove && target.getAttribute('aria-checked') !== 'true') target.click();
  };
}

/** Atributos de uma opção: `checked` e se ela recebe o Tab (`first` = é a primeira e nenhuma está marcada). */
export const radio = (checked: boolean, first = false) => ({
  role: 'radio' as const,
  'aria-checked': checked,
  tabIndex: checked || first ? 0 : -1,
});
