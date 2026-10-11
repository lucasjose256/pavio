import { describe, expect, it } from 'vitest';
import { toolbarIconFor } from './toolbar-icon';

const now = 1_000_000;
const lit = { status: 'active' as const, endsAt: now + 60_000 };

describe('toolbarIconFor', () => {
  it('aceso só com vela ativa dentro do tempo e a opção ligada', () => {
    expect(toolbarIconFor(lit, true, now)).toBe('active');
    expect(toolbarIconFor(lit, false, now)).toBe('idle');
    expect(toolbarIconFor(undefined, true, now)).toBe('idle');
  });
  it('apagado depois do fim e com a sessão encerrada', () => {
    expect(toolbarIconFor({ ...lit, endsAt: now }, true, now)).toBe('idle');
    expect(toolbarIconFor({ status: 'abandoned', endsAt: now + 1 }, true, now)).toBe('idle');
    expect(toolbarIconFor({ status: 'completed', endsAt: now + 1 }, true, now)).toBe('idle');
  });
});
