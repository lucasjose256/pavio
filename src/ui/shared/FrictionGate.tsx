import { useState } from 'preact/hooks';
import { evaluateFriction, type FrictionStep } from '../../core/friction';
import './friction-gate.css';

/**
 * A fricção de liberar algo, embutida na tela (sem espera): Leve = o próprio botão confirma; Firme = digitar a frase.
 * Colar é bloqueado de propósito.
 */
export function FrictionGate({ steps, action, onDone, onCancel, cancelLabel = 'Deixa para lá' }: {
  steps: FrictionStep[];
  action: string;
  onDone: () => void | Promise<void>;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const phrase = steps.find((s) => s.type === 'typePhrase');
  // O clique no botão é a confirmação do modo Leve.
  const done = evaluateFriction(steps, { elapsedMs: Number.MAX_SAFE_INTEGER, typed, confirmed: true, challengesPassed: [] }).done;
  async function submit(e: Event) {
    e.preventDefault();
    if (!done || busy) return;
    setBusy(true);
    try { await onDone(); } finally { setBusy(false); }
  }
  return (
    <form class="fgate" onSubmit={submit}>
      {phrase?.type === 'typePhrase' && (
        <label class="fgate-phrase">
          <span>Para liberar, digite: <q>{phrase.phrase}</q></span>
          <input class="field" value={typed} autocomplete="off" spellcheck={false} placeholder="Digite a frase aqui" autoFocus
            onInput={(e) => setTyped(e.currentTarget.value)} onPaste={(e) => e.preventDefault()} />
        </label>
      )}
      <div class="fgate-buttons">
        <button type="button" class="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
        <button type="submit" class="btn btn-primary" disabled={!done || busy}>{action}</button>
      </div>
    </form>
  );
}
