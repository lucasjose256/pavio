import { FEATURE_DEFS, defaultSpec, featuresOf, serviceKindFor, specToggleFeature, specWithKind, specWithMode } from '../../core/restrictions';
import type { RestrictedKind, RestrictionSpec } from '../../core/models';
import { featureHelp, featureLabel, kindLabel, modeLabel } from '../i18n/pt-BR';

interface Props {
  domain: string;
  /** `mode` ausente = a pessoa ainda não escolheu. */
  spec: Partial<RestrictionSpec>;
  onChange: (spec: RestrictionSpec) => void;
}

const MODES: RestrictionSpec['mode'][] = ['blocked', 'restricted'];

/** O que fazer com o site: bloquear, ou restringir (esconder partes do serviço / modo intenção). */
export function RestrictionPicker({ domain, spec, onChange }: Props) {
  const service = serviceKindFor(domain);
  const kinds: RestrictedKind[] = [...new Set([service, spec.restrictedKind, 'intent'].filter(Boolean) as RestrictedKind[])];
  const kind = spec.restrictedKind;

  return (
    <div class="picker">
      <div class="segmented" role="radiogroup" aria-label="O que fazer com o site">
        {MODES.map((m) => (
          <button key={m} type="button" role="radio" class={`m-${m}`} aria-checked={spec.mode === m} onClick={() => onChange(spec.mode ? specWithMode(spec as RestrictionSpec, domain, m) : defaultSpec(domain, m))}>
            {modeLabel[m]}
          </button>
        ))}
      </div>

      {!spec.mode && <p class="hint">Escolha uma opção: bloquear o site ou restringir (esconder partes / pedir a intenção).</p>}
      {spec.mode === 'restricted' && (
        <>
          <select class="field" aria-label="Como restringir" value={kind} onChange={(e) => onChange(specWithKind(spec as RestrictionSpec, e.currentTarget.value as RestrictedKind))}>
            {kinds.map((k) => <option value={k}>{kindLabel[k]}</option>)}
          </select>
          {kind && kind !== 'intent' && (
            <div class="features inline" role="group" aria-label={`O que esconder em ${domain}`}>
              <span class="features-label" title={featureHelp}>Esconder:</span>
              {FEATURE_DEFS[kind].map((f) => (
                <button key={f.id} type="button" class="chip is-feature" aria-pressed={featuresOf(spec).has(f.id)} onClick={() => onChange(specToggleFeature(spec as RestrictionSpec, f.id))}>
                  {featureLabel[kind]?.[f.id] ?? f.id}
                </button>
              ))}
            </div>
          )}
          {kind === 'intent' && <p class="hint">Ao abrir o site, pergunta o que você vai fazer e por quanto tempo.</p>}
        </>
      )}
    </div>
  );
}
