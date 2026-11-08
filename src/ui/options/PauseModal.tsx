import { useState } from 'preact/hooks';
import { frictionForRelease } from '../../core/friction';
import type { Strictness } from '../../core/models';
import { PAUSE_MINUTES, type PauseChoice } from '../../core/release';
import { pauseUi } from '../i18n/pt-BR';
import { FrictionGate } from '../shared/FrictionGate';
import { radio, radioKeys } from '../shared/radioGroup';

/** "manual" = desligar até a pessoa religar (sem prazo). */
export type PauseAnswer = PauseChoice | { kind: 'manual' };

const key = (a: PauseAnswer) => (a.kind === 'min' ? `m${a.minutes}` : a.kind);
const choicesFor = (minutes: readonly number[]): PauseAnswer[] => [...minutes.map((m) => ({ kind: 'min' as const, minutes: m })), { kind: 'day' }, { kind: 'manual' }];

/**
 * Ao desligar (um app ou uma faixa): por quanto tempo? 5 / 15 / 30 min, até o fim do dia ou até religar.
 * A fricção (Leve ou Firme) só entra se pausar tira uma proteção que vale agora.
 */
export function PauseModal({ title, needsGate, level, onChoose, onCancel, minutes = PAUSE_MINUTES, manualLabel = pauseUi.manual, hint = pauseUi.hint, cancelLabel = pauseUi.cancel, verb = 'Pausar' }: {
  /** Verbo do botão ("Pausar · 15 min" / "Desligar · 15 min"). */
  verb?: string;
  title: string;
  /** Quais tempos oferecer (padrão: 5, 15, 30 min). */
  minutes?: readonly number[];
  manualLabel?: string;
  hint?: string;
  cancelLabel?: string;
  needsGate: boolean;
  level: Strictness;
  onChoose: (answer: PauseAnswer) => void | Promise<void>;
  onCancel: () => void;
}) {
  const CHOICES = choicesFor(minutes);
  const label = (a: PauseAnswer) => (a.kind === 'min' ? pauseUi.min(a.minutes) : a.kind === 'day' ? pauseUi.day : manualLabel);
  const [choice, setChoice] = useState<PauseAnswer>(CHOICES[Math.min(1, CHOICES.length - 1)]!);
  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div class="modal-card">
        <h3>{title}</h3>
        <p class="hint">{hint}</p>
        <div class="pause-choices" role="radiogroup" aria-label="Por quanto tempo" onKeyDown={radioKeys()}>
          {CHOICES.map((c) => (
            <button key={key(c)} type="button" {...radio(key(c) === key(choice))} class="chip" onClick={() => setChoice(c)}>{label(c)}</button>
          ))}
        </div>
        <FrictionGate steps={needsGate ? frictionForRelease(level) : []} action={`${verb} · ${label(choice)}`} cancelLabel={cancelLabel}
          onDone={() => onChoose(choice)} onCancel={onCancel} />
      </div>
    </div>
  );
}
