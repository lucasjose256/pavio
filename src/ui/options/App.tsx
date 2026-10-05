import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  SUGGESTED_SITES, createEnvironment, createRule, defaultRestrictedKind, validateEnvironment,
} from '../../core/environments';
import { DEFAULT_SETTINGS } from '../../core/models';
import type { Environment, RestrictedKind, Rule, RuleMode, Settings } from '../../core/models';
import { randomId } from '../../core/ports';
import { createServices } from '../../platform/chrome/services';
import { ensureHostAccess } from '../../platform/chrome/permissions';
import { Candle } from '../candle/Candle';
import { SKINS } from '../candle/skins';
import { kindLabel, modeHelp, modeLabel, validationMessage } from '../i18n/pt-BR';

const services = createServices();
const MODES: RuleMode[] = ['allowed', 'blocked', 'restricted'];
const KINDS: RestrictedKind[] = ['youtube', 'instagram', 'x', 'intent'];

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

export function App() {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<Environment>();
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sessionActive, setSessionActive] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [newMode, setNewMode] = useState<RuleMode>('blocked');
  const [preview, setPreview] = useState(0.7);
  const [melting, setMelting] = useState(false);
  const loaded = useRef(false);

  async function reload(selectId?: string) {
    const list = await services.environments.list();
    setEnvs(list);
    const id = selectId ?? selectedId ?? list[0]?.id;
    const env = list.find((e) => e.id === id) ?? list[0];
    setSelectedId(env?.id);
    setDraft(env ? structuredClone(env) : undefined);
    setDirty(false);
  }

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    void reload();
    void services.settings.get().then(setSettings);
    void services.sessions.get().then((s) => setSessionActive(s?.status === 'active'));
  }, []);

  // Simulação do derretimento na prévia das skins.
  useEffect(() => {
    if (!melting) return;
    const id = setInterval(() => setPreview((p) => (p <= 0.02 ? (setMelting(false), 0) : p - 0.02)), 150);
    return () => clearInterval(id);
  }, [melting]);

  const draftDomains = useMemo(() => new Set(draft?.rules.map((r) => r.domain)), [draft]);

  function edit(fn: (env: Environment) => void) {
    if (!draft) return;
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
    setDirty(true);
    setNotice(undefined);
  }

  function select(id: string) {
    if (id === selectedId) return;
    if (dirty && !confirm('Descartar as alterações não salvas?')) return;
    setNotice(undefined);
    void reload(id);
  }

  async function createNew() {
    if (dirty && !confirm('Descartar as alterações não salvas?')) return;
    const env = await services.environments.save(createEnvironment('Novo ambiente', Date.now(), randomId));
    await reload(env.id);
  }

  async function save() {
    if (!draft) return;
    const errors = validateEnvironment(draft);
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(validationMessage).join(' ') });
    // Primeiro a permissão (precisa do clique do usuário), depois o storage.
    const domains = draft.rules.filter((r) => r.mode !== 'allowed').map((r) => r.domain);
    const granted = await ensureHostAccess(domains);
    const saved = await services.environments.save(draft);
    await reload(saved.id);
    setNotice(
      granted
        ? { kind: 'ok', text: 'Ambiente salvo.' }
        : { kind: 'warn', text: 'Salvo, mas sem permissão de acesso aos sites o bloqueio não vai funcionar. Salve de novo e permita.' },
    );
  }

  async function remove() {
    if (!draft || draft.builtin || !confirm(`Apagar o ambiente "${draft.name}"?`)) return;
    await services.environments.remove(draft.id);
    await reload(envs.find((e) => e.id !== draft.id)?.id);
  }

  async function restore() {
    if (!draft || !confirm('Voltar este ambiente de exemplo ao padrão?')) return;
    await services.environments.restoreBuiltin(draft.id);
    await reload(draft.id);
    setNotice({ kind: 'ok', text: 'Ambiente restaurado.' });
  }

  function addRule(input: string, mode: RuleMode) {
    const rule = createRule(input, mode, randomId);
    if (!rule) return setNotice({ kind: 'error', text: 'Esse endereço não parece um site válido (ex.: reddit.com).' });
    if (draftDomains.has(rule.domain)) return setNotice({ kind: 'error', text: `${rule.domain} já está na lista.` });
    edit((env) => env.rules.push(rule));
    setNewDomain('');
  }

  function setRuleMode(rule: Rule, mode: RuleMode) {
    edit((env) => {
      const r = env.rules.find((x) => x.id === rule.id)!;
      r.mode = mode;
      if (mode === 'restricted') r.restrictedKind = r.restrictedKind ?? defaultRestrictedKind(r.domain);
      else delete r.restrictedKind;
    });
  }

  async function pickSkin(id: string) {
    setSettings(await services.settings.update({ candleSkin: id }));
  }

  const suggestions = SUGGESTED_SITES.filter((s) => !draftDomains.has(s.domain));

  return (
    <div class="layout">
      <header class="top">
        <h1>Pavio</h1>
        <p>Você não controla você, mas pode controlar seu ambiente.</p>
      </header>

      <aside class="side" aria-label="Ambientes">
        <h2>Ambientes</h2>
        <ul>
          {envs.map((e) => (
            <li key={e.id}>
              <button class={`env-btn ${e.id === selectedId ? 'on' : ''}`} onClick={() => select(e.id)}>
                {e.name}
                {e.builtin && <span class="tag">exemplo</span>}
              </button>
            </li>
          ))}
        </ul>
        <button class="btn" onClick={createNew}>+ Novo ambiente</button>
      </aside>

      <main class="main">
        {sessionActive && (
          <p class="notice warn">Há uma sessão em andamento: as mudanças valem a partir da próxima sessão.</p>
        )}

        {draft && (
          <section class="card">
            <div class="row">
              <label class="grow">
                <span class="lbl">Nome do ambiente</span>
                <input class="field full" value={draft.name} maxLength={40}
                  onInput={(e) => edit((env) => { env.name = e.currentTarget.value; })} />
              </label>
            </div>

            <h3>Regras por site</h3>
            <p class="hint">Sites que não estão na lista ficam liberados.</p>
            {draft.rules.length === 0 && <p class="empty">Nenhum site ainda. Adicione abaixo.</p>}
            <ul class="rules">
              {draft.rules.map((r) => (
                <li key={r.id} class="rule">
                  <span class="domain">{r.domain}</span>
                  <select class="field" aria-label={`Regra de ${r.domain}`} value={r.mode}
                    onChange={(e) => setRuleMode(r, e.currentTarget.value as RuleMode)} title={modeHelp[r.mode]}>
                    {MODES.map((m) => <option value={m}>{modeLabel[m]}</option>)}
                  </select>
                  {r.mode === 'restricted' ? (
                    <select class="field" aria-label={`Tipo de restrição de ${r.domain}`} value={r.restrictedKind}
                      onChange={(e) => edit((env) => { env.rules.find((x) => x.id === r.id)!.restrictedKind = e.currentTarget.value as RestrictedKind; })}>
                      {KINDS.map((k) => <option value={k}>{kindLabel[k]}</option>)}
                    </select>
                  ) : <span />}
                  <button class="btn btn-ghost" aria-label={`Remover ${r.domain}`}
                    onClick={() => edit((env) => { env.rules = env.rules.filter((x) => x.id !== r.id); })}>✕</button>
                </li>
              ))}
            </ul>

            <form class="add" onSubmit={(e) => { e.preventDefault(); addRule(newDomain, newMode); }}>
              <input class="field grow" placeholder="Adicionar site (ex.: reddit.com)" value={newDomain}
                onInput={(e) => setNewDomain(e.currentTarget.value)} />
              <select class="field" aria-label="Regra do novo site" value={newMode}
                onChange={(e) => setNewMode(e.currentTarget.value as RuleMode)}>
                {MODES.map((m) => <option value={m}>{modeLabel[m]}</option>)}
              </select>
              <button class="btn" type="submit">Adicionar</button>
            </form>

            {suggestions.length > 0 && (
              <div class="chips">
                <span class="hint">Sugestões:</span>
                {suggestions.map((s) => (
                  <button class="chip" onClick={() => addRule(s.domain, 'blocked')}>+ {s.name}</button>
                ))}
              </div>
            )}

            {notice && <p class={`notice ${notice.kind}`} role="status">{notice.text}</p>}

            <div class="actions">
              <button class="btn btn-primary" disabled={!dirty} onClick={save}>Salvar</button>
              {dirty && <button class="btn btn-ghost" onClick={() => reload(draft.id)}>Descartar</button>}
              <span class="grow" />
              {draft.builtin
                ? <button class="btn btn-ghost" onClick={restore}>Restaurar padrão</button>
                : <button class="btn btn-ghost btn-danger" onClick={remove}>Apagar ambiente</button>}
            </div>
            <p class="hint perm">
              Ao salvar, o Chrome pede acesso aos sites bloqueados/restritos. O Pavio usa esse acesso só para
              bloquear ou limitar essas páginas; nada sai do seu computador.
            </p>
          </section>
        )}

        <section class="card">
          <h3>Estilo da vela</h3>
          <div class="preview-bar">
            <label class="grow">
              <span class="lbl">Cera restante: {Math.round(preview * 100)}%</span>
              <input type="range" min={0} max={1} step={0.01} value={preview} class="full"
                onInput={(e) => { setMelting(false); setPreview(Number(e.currentTarget.value)); }} />
            </label>
            <button class="btn" onClick={() => { if (preview <= 0.02) setPreview(1); setMelting((m) => !m); }}>
              {melting ? 'Pausar' : 'Ver derretendo'}
            </button>
          </div>
          <div class="skins">
            {SKINS.map((s) => (
              <button key={s.id} class={`skin ${settings.candleSkin === s.id ? 'on' : ''}`}
                aria-pressed={settings.candleSkin === s.id} onClick={() => pickSkin(s.id)}>
                <div class="skin-candle"><Candle skin={s.id} progress={preview} /></div>
                <span>{s.name}</span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
