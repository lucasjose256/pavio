import { useEffect, useMemo, useState } from 'preact/hooks';
import { accessDomains } from '../../core/blocking';
import {
  SUGGESTED_SITES, createEnvironment, createRule, defaultRestrictedKind, duplicateEnvironment, ruleCounts, validateEnvironment,
} from '../../core/environments';
import type { Environment, RestrictedKind, Rule, RuleMode } from '../../core/models';
import { randomId } from '../../core/ports';
import { FEATURE_DEFS, defaultFeatures, featuresOf, serviceKindFor } from '../../core/restrictions';
import { ensureHostAccess, hostPattern } from '../../platform/chrome/permissions';
import { featureHelp, featureLabel, kindLabel, modeHelp, modeLabel, shopUi, validationMessage } from '../i18n/pt-BR';
import { Candle } from '../candle/Candle';
import { SiteIcon } from '../shared/SiteIcon';
import { services } from './shared';

const MODES: RuleMode[] = ['allowed', 'blocked', 'restricted'];

type Notice = { kind: 'ok' | 'warn' | 'error'; text: string };

/** Domínios (que precisam de acesso opcional) sem permissão concedida. */
async function missingAccess(env: Environment | undefined): Promise<string[]> {
  if (!env) return [];
  const domains = accessDomains(env);
  const granted = await Promise.all(domains.map((d) => chrome.permissions.contains({ origins: [hostPattern(d)] })));
  return domains.filter((_, i) => !granted[i]);
}

export function EnvironmentsTab({ active }: { active: boolean }) {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [draft, setDraft] = useState<Environment>();
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [sessionActive, setSessionActive] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [newMode, setNewMode] = useState<RuleMode>('blocked');
  const [skin, setSkin] = useState('classic');
  const [shopOn, setShopOn] = useState(false);

  async function reload(selectId?: string) {
    const list = await services.environments.list();
    const env = list.find((e) => e.id === (selectId ?? selectedId)) ?? list[0];
    setEnvs(list);
    setSelectedId(env?.id);
    setDraft(env ? structuredClone(env) : undefined);
    setDirty(false);
    setMissing(await missingAccess(env));
  }

  useEffect(() => {
    void reload();
    void services.sessions.get().then((s) => setSessionActive(s?.status === 'active'));
    void services.settings.get().then((st) => { setSkin(st.candleSkin); setShopOn(st.shopSuggestions); });
  }, []);

  const domains = useMemo(() => new Set(draft?.rules.map((r) => r.domain)), [draft]);
  const suggestions = SUGGESTED_SITES.filter((s) => !domains.has(s.domain));

  function edit(fn: (env: Environment) => void) {
    if (!draft) return;
    const next = structuredClone(draft);
    fn(next);
    setDraft(next);
    setDirty(true);
    setNotice(undefined);
  }

  const confirmDiscard = () => !dirty || confirm('Descartar as alterações não salvas?');

  function select(id: string) {
    if (id === selectedId || !confirmDiscard()) return;
    setNotice(undefined);
    void reload(id);
  }

  async function createNew() {
    if (!confirmDiscard()) return;
    const env = await services.environments.save(createEnvironment('Novo ambiente', Date.now(), randomId));
    await reload(env.id);
  }

  async function duplicate() {
    if (!draft || !confirmDiscard()) return;
    const copy = await services.environments.save(duplicateEnvironment(draft, Date.now(), randomId));
    await reload(copy.id);
    setNotice({ kind: 'ok', text: 'Cópia criada. Agora você pode ajustar à vontade.' });
  }

  async function save() {
    if (!draft) return;
    const errors = validateEnvironment(draft);
    if (errors.length) return setNotice({ kind: 'error', text: errors.map(validationMessage).join(' ') });
    // Primeiro a permissão (precisa do clique do usuário), depois o storage.
    const granted = await ensureHostAccess(accessDomains(draft));
    const saved = await services.environments.save(draft);
    await reload(saved.id);
    if (!granted) setNotice({ kind: 'warn', text: 'Salvo, mas sem acesso aos sites o bloqueio não funciona. Use "Conceder acesso" abaixo.' });
    else setNotice({ kind: 'ok', text: 'Ambiente salvo.' });
  }

  async function grantAccess() {
    await ensureHostAccess(missing);
    setMissing(await missingAccess(envs.find((e) => e.id === selectedId)));
  }

  async function remove() {
    if (!draft || draft.builtin) return;
    if (!confirm(`Apagar o ambiente "${draft.name}"?`)) return;
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
    if (domains.has(rule.domain)) return setNotice({ kind: 'error', text: `${rule.domain} já está na lista.` });
    edit((env) => env.rules.push(rule));
    setNewDomain('');
  }

  function setMode(rule: Rule, mode: RuleMode) {
    edit((env) => {
      const r = env.rules.find((x) => x.id === rule.id)!;
      r.mode = mode;
      if (mode === 'restricted') {
        r.restrictedKind = r.restrictedKind ?? defaultRestrictedKind(r.domain);
        if (r.restrictedKind !== 'intent') r.features = r.features ?? defaultFeatures(r.restrictedKind);
      } else {
        delete r.restrictedKind;
        delete r.features;
      }
    });
  }

  /** Troca entre "esconder partes do serviço" e "modo intenção". */
  function setKind(rule: Rule, kind: RestrictedKind) {
    edit((env) => {
      const r = env.rules.find((x) => x.id === rule.id)!;
      r.restrictedKind = kind;
      if (kind === 'intent') delete r.features;
      else r.features = defaultFeatures(kind);
    });
  }

  function toggleFeature(rule: Rule, id: string) {
    edit((env) => {
      const r = env.rules.find((x) => x.id === rule.id)!;
      const set = featuresOf(r);
      if (!set.delete(id)) set.add(id);
      r.features = FEATURE_DEFS[r.restrictedKind as keyof typeof FEATURE_DEFS].map((f) => f.id).filter((f) => set.has(f));
    });
  }

  return (
    <main class="pane" hidden={!active}>
      {sessionActive && <p class="notice warn">Há uma sessão em andamento: o que você mudar vale a partir da próxima.</p>}

      <section class="card timer-hero" aria-label="Como funciona o Timer">
        <div class="hero-candle" aria-hidden="true"><Candle skin={skin} progress={0.8} /></div>
        <div>
          <h2 class="section-title">Timer: um foco a mais</h2>
          <p class="section-sub">Quando precisar de um tempo protegido, acenda a vela. Enquanto ela queima, as regras do ambiente escolhido valem por cima da sua rotina.</p>
          <ol class="steps-row">
            <li>Monte aqui um <strong>ambiente</strong>: o que fica bloqueado, restrito ou liberado.</li>
            <li>Clique no ícone do <strong>Pavio</strong> na barra do Chrome e escolha o ambiente e o tempo.</li>
            <li>Acenda a <strong>vela</strong>. Parar antes da hora pede um pouco de calma.</li>
          </ol>
          {shopOn && <p class="hint hero-tip">{shopUi.timerHint} <a href="#velas">{shopUi.timerLink} →</a></p>}
        </div>
      </section>

      <section aria-label="Escolha o ambiente">
        <h2 class="section-title">Seus ambientes</h2>
        <p class="section-sub">Escolha um para ver e editar.</p>
        <ul class="env-grid">
          {envs.map((e) => {
            const c = ruleCounts(e);
            return (
              <li key={e.id}>
                <button class={`env-card ${e.id === selectedId ? 'on' : ''}`} onClick={() => select(e.id)} aria-pressed={e.id === selectedId}>
                  <span class="env-name">{e.name}{e.builtin && <span class="tag">exemplo</span>}</span>
                  <span class="dots" aria-hidden="true">
                    {e.rules.slice(0, 8).map((r) => <i key={r.id} class={`dot m-${r.mode}`} title={r.domain} />)}
                  </span>
                  <span class="env-meta">
                    {c.blocked} bloqueados · {c.restricted} restritos · {c.allowed} liberados
                  </span>
                </button>
              </li>
            );
          })}
          <li>
            <button class="env-card new" onClick={createNew}>
              <span class="plus" aria-hidden="true">+</span>
              <span>Novo ambiente</span>
            </button>
          </li>
        </ul>
      </section>

      {draft && (
        <section class="card" aria-label={`Editar ${draft.name}`}>
          <div class="editor-head">
            <label class="grow">
              <span class="lbl">Nome do ambiente</span>
              <input class="field full name-input" value={draft.name} maxLength={40}
                onInput={(e) => edit((env) => { env.name = e.currentTarget.value; })} />
            </label>
            <div class="head-actions">
              <button class="btn btn-ghost" onClick={duplicate}>Duplicar</button>
              {draft.builtin
                ? <button class="btn btn-ghost" onClick={restore}>Restaurar padrão</button>
                : <button class="btn btn-ghost btn-danger" onClick={remove}>Apagar</button>}
            </div>
          </div>

          <h3>Regras por site</h3>
          <ul class="legend">
            {MODES.map((m) => (
              <li key={m}><i class={`dot m-${m}`} /><strong>{modeLabel[m]}</strong> <span>{modeHelp[m]}</span></li>
            ))}
          </ul>

          <p class="hint">{featureHelp}</p>
          {draft.rules.length === 0 && <p class="empty">Nenhum site por aqui ainda. Adicione o primeiro abaixo, ou toque numa sugestão.</p>}
          <ul class="rules">
            {draft.rules.map((r) => (
              <li key={r.id} class="rule">
                <SiteIcon domain={r.domain} size={26} class={`ring m-${r.mode}`} />
                <span class="domain">{r.domain}</span>
                <div class="seg-group" role="group" aria-label={`Regra de ${r.domain}`}>
                  {MODES.map((m) => (
                    <button key={m} class={`seg-btn m-${m}`} aria-pressed={r.mode === m} onClick={() => setMode(r, m)}>{modeLabel[m]}</button>
                  ))}
                </div>
                {r.mode === 'restricted' ? (
                  <select class="field kind" aria-label={`Como restringir ${r.domain}`} value={r.restrictedKind}
                    onChange={(e) => setKind(r, e.currentTarget.value as RestrictedKind)}>
                    {[...new Set([serviceKindFor(r.domain), r.restrictedKind, 'intent'].filter(Boolean) as RestrictedKind[])]
                      .map((k) => <option value={k}>{kindLabel[k]}</option>)}
                  </select>
                ) : <span class="kind" />}
                <button class="btn btn-ghost x" aria-label={`Remover ${r.domain}`}
                  onClick={() => edit((env) => { env.rules = env.rules.filter((x) => x.id !== r.id); })}>✕</button>
                {r.mode === 'restricted' && r.restrictedKind && r.restrictedKind !== 'intent' && (
                  <div class="features" role="group" aria-label={`O que esconder em ${r.domain}`}>
                    <span class="features-label">Esconder:</span>
                    {FEATURE_DEFS[r.restrictedKind].map((f) => (
                      <button key={f.id} type="button" class="feat" aria-pressed={featuresOf(r).has(f.id)} onClick={() => toggleFeature(r, f.id)}>
                        {featureLabel[r.restrictedKind!]?.[f.id] ?? f.id}
                      </button>
                    ))}
                  </div>
                )}
                {r.mode === 'restricted' && r.restrictedKind === 'intent' && (
                  <p class="features-note">Ao abrir o site, pergunta o que você vai fazer e por quanto tempo.</p>
                )}
              </li>
            ))}
          </ul>

          <form class="add" onSubmit={(e) => { e.preventDefault(); addRule(newDomain, newMode); }}>
            <input class="field grow" placeholder="Adicionar site (ex.: reddit.com)" value={newDomain} aria-label="Novo site"
              onInput={(e) => setNewDomain(e.currentTarget.value)} />
            <select class="field" aria-label="Regra do novo site" value={newMode} onChange={(e) => setNewMode(e.currentTarget.value as RuleMode)}>
              {MODES.map((m) => <option value={m}>{modeLabel[m]}</option>)}
            </select>
            <button class="btn" type="submit">Adicionar</button>
          </form>

          {suggestions.length > 0 && (
            <div class="chips">
              <span class="hint">Sugestões:</span>
              {suggestions.map((s) => (
                <button key={s.domain} class="chip" onClick={() => addRule(s.domain, 'blocked')}>+ {s.name}</button>
              ))}
            </div>
          )}

          {missing.length > 0 && !dirty && (
            <div class="notice warn access">
              <span>O Chrome ainda não deu acesso a <strong>{missing.join(', ')}</strong>. Sem isso, o bloqueio não funciona.</span>
              <button class="btn btn-primary" onClick={grantAccess}>Conceder acesso</button>
            </div>
          )}
          {notice && <p class={`notice ${notice.kind}`} role="status">{notice.text}</p>}
          <p class="hint perm">
            O acesso aos sites serve só para bloquear ou limitar essas páginas. Nada sai do seu computador.
          </p>
        </section>
      )}

      {dirty && (
        <div class="savebar" role="region" aria-label="Alterações não salvas">
          <span>Você tem alterações não salvas</span>
          <button class="btn btn-ghost" onClick={() => reload(draft?.id)}>Descartar</button>
          <button class="btn btn-primary" onClick={save}>Salvar</button>
        </div>
      )}
    </main>
  );
}
