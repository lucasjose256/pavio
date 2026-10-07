import { useState } from 'preact/hooks';
import { frictionForRelease } from '../../core/friction';
import type { Strictness } from '../../core/models';
import { PAUSE_MINUTES, type PauseChoice } from '../../core/release';
import { pauseUi } from '../i18n/pt-BR';
import { FrictionGate } from '../shared/FrictionGate';

/** "manual" = desligar até a pessoa religar (sem prazo). */
export type PauseAnswer = PauseChoice | { kind: 'manual' };

const key = (a: PauseAnswer) => (a.kind === 'min' ? `m${a.minutes}` : a.kind);
const label = (a: PauseAnswer) => (a.kind === 'min' ? pauseUi.min(a.minutes) : a.kind === 'day' ? pauseUi.day : pauseUi.manual);

const CHOICES: PauseAnswer[] = [...PAUSE_MINUTES.map((minutes) => ({ kind: 'min' as const, minutes })), { kind: 'day' }, { kind: 'manual' }];

/**
 * Ao desligar (um app ou uma faixa): por quanto tempo? 5 / 15 / 30 min, até o fim do dia ou até religar.
 * A fricção (Leve ou Firme) só entra se pausar tira uma proteção que vale agora.
 */
export function PauseModal({ title, needsGate, level, onChoose, onCancel }: {
  title: string;
  needsGate: boolean;
  level: Strictness;
  onChoose: (answer: PauseAnswer) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [choice, setChoice] = useState<PauseAnswer>(CHOICES[1]!);
  return (
    <div class="modal" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <div class="modal-card">
        <h3>{title}</h3>
        <p class="hint">{pauseUi.hint}</p>
        <div class="pause-choices" role="radiogroup" aria-label="Por quanto tempo">
          {CHOICES.map((c) => (
            <button key={key(c)} type="button" role="radio" aria-checked={key(c) === key(choice)} class="chip pause-chip" onClick={() => setChoice(c)}>{label(c)}</button>
          ))}
        </div>
        <FrictionGate steps={needsGate ? frictionForRelease(level) : []} action={pauseUi.action(label(choice))} cancelLabel={pauseUi.cancel}
          onDone={() => onChoose(choice)} onCancel={onCancel} />
      </div>
    </div>
  );
}
