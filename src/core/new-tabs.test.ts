import { describe, expect, it } from 'vitest';
import type { Session } from './models';
import { blocksNewTabs, shouldCloseNewTab } from './new-tabs';

const now = 1_000_000;
const session = (over: Partial<Session> = {}): Pick<Session, 'status' | 'endsAt' | 'pomodoro' | 'blockNewTabs'> => ({
  status: 'active', endsAt: now + 600_000, blockNewTabs: true, ...over,
});

describe('blocksNewTabs', () => {
  it('só com a vela valendo e a opção ligada', () => {
    expect(blocksNewTabs(session(), now)).toBe(true);
    expect(blocksNewTabs(session({ blockNewTabs: false }), now)).toBe(false);
    expect(blocksNewTabs(session({ blockNewTabs: undefined }), now)).toBe(false);
    expect(blocksNewTabs(undefined, now)).toBe(false);
  });
  it('não depois do fim nem com a sessão encerrada', () => {
    expect(blocksNewTabs(session({ endsAt: now }), now)).toBe(false);
    expect(blocksNewTabs(session({ status: 'abandoned' }), now)).toBe(false);
  });
  it('não na pausa do Pomodoro', () => {
    const onBreak = session({ pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4, phase: 'break', cycle: 1, long: false, phaseEndsAt: now + 1000 } });
    expect(blocksNewTabs(onBreak, now)).toBe(false);
    const focus = session({ pomodoro: { focusMin: 25, breakMin: 5, longBreakMin: 0, cyclesBeforeLong: 4, phase: 'focus', cycle: 1, long: false, phaseEndsAt: now + 1000 } });
    expect(blocksNewTabs(focus, now)).toBe(true);
  });
});

describe('shouldCloseNewTab', () => {
  it('fecha abas comuns; poupa as do Pavio e as janelinhas de login', () => {
    expect(shouldCloseNewTab({ own: false, windowType: 'normal' })).toBe(true);
    expect(shouldCloseNewTab({ own: false, windowType: undefined })).toBe(true);
    expect(shouldCloseNewTab({ own: true, windowType: 'normal' })).toBe(false);
    expect(shouldCloseNewTab({ own: false, windowType: 'popup' })).toBe(false);
  });
});
