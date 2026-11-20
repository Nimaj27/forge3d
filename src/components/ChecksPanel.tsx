/** Panneau « Vérifications avant impression » : icône + texte, jamais la couleur seule. */
import type { Part } from '../../shared/scene';
import type { CheckFix, CheckItem, CheckLevel, PartReport } from '../geometry/types';
import { Icon, type IconName } from './Icon';

const ORDER: CheckItem['id'][] = ['bed', 'manifold', 'thin', 'overhang', 'flat'];
const PENDING_LABEL: Record<CheckItem['id'], string> = {
  bed: 'Taille par rapport au plateau',
  manifold: 'Étanchéité du maillage',
  thin: 'Détails fins',
  overhang: 'Surplombs',
  flat: 'Pose sur le plateau',
};
const ICON: Record<CheckLevel, IconName> = { ok: 'check', warn: 'warning', error: 'error', pending: 'dots' };
const LEVEL_TEXT: Record<CheckLevel, string> = { ok: 'Validé', warn: 'Attention', error: 'Problème', pending: 'En cours' };
const FIX_LABEL: Record<CheckFix, string> = {
  layFlat: 'Coucher la pièce',
  rotate90: 'Pivoter de 90°',
  dropToBed: 'Poser sur le plateau',
};

export interface ExtraCheck {
  level: CheckLevel;
  message: string;
}

interface ChecksPanelProps {
  parts: readonly Part[];
  reports: Record<string, PartReport>;
  checking: boolean;
  onFix?: (partId: string, fix: CheckFix) => void;
  extra?: ExtraCheck[];
  title?: string;
}

export function ChecksPanel({ parts, reports, checking, onFix, extra = [], title = 'Vérifications avant impression' }: ChecksPanelProps) {
  const multi = parts.length > 1;
  const lines: { key: string; level: CheckLevel; message: string; detail?: string; fix?: { partId: string; fix: CheckFix } }[] = [];

  for (const id of ORDER) {
    const perPart = parts.map((p) => ({ part: p, item: reports[p.id]?.checks.find((c) => c.id === id) }));
    if (perPart.some((x) => !x.item)) {
      if (reports[parts[0]?.id]?.checks.length === 1 && id !== 'manifold') continue; // pièce vide
      lines.push({ key: id, level: 'pending', message: PENDING_LABEL[id] });
      continue;
    }
    const problems = perPart.filter((x) => x.item!.level !== 'ok');
    if (!problems.length) {
      lines.push({ key: id, level: 'ok', message: perPart[0].item!.message });
      continue;
    }
    for (const { part, item } of problems) {
      lines.push({
        key: `${id}-${part.id}`,
        level: item!.level,
        message: multi ? `${part.name} : ${item!.message}` : item!.message,
        detail: item!.detail,
        fix: item!.fix ? { partId: part.id, fix: item!.fix } : undefined,
      });
    }
  }
  extra.forEach((e, i) => lines.push({ key: `extra-${i}`, level: e.level, message: e.message }));

  return (
    <section className="card checks" aria-label={title} aria-busy={checking}>
      <h2 className="card__title" style={{ fontFamily: 'var(--font-ui)', fontSize: 14 }}>
        {title}
      </h2>
      <ul className="checks__list">
        {lines.map((l) => (
          <li key={l.key} className={`check-line check-line--${l.level}`}>
            <Icon name={ICON[l.level]} strokeWidth={2.2} />
            <span>
              <span className="sr-only">{LEVEL_TEXT[l.level]} : </span>
              {l.message}
              {l.detail && <span className="check-line__detail">{l.detail}</span>}
              {l.fix && onFix && (
                <button type="button" className="btn btn--sm check-line__fix" onClick={() => onFix(l.fix!.partId, l.fix!.fix)}>
                  {FIX_LABEL[l.fix.fix]}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Pastille de statut global (« Prêt à imprimer »…). */
export function StatusPill({ level, compact }: { level: CheckLevel; compact?: boolean }) {
  const map: Record<CheckLevel, { cls: string; text: string; short: string; icon: IconName }> = {
    ok: { cls: 'pill--success', text: 'Prêt à imprimer', short: 'Prêt', icon: 'check' },
    warn: { cls: 'pill--warning', text: 'À vérifier', short: 'À vérifier', icon: 'warning' },
    error: { cls: 'pill--danger', text: 'À corriger', short: 'À corriger', icon: 'error' },
    pending: { cls: '', text: 'Vérification…', short: '…', icon: 'dots' },
  };
  const m = map[level];
  return (
    <span className={`pill ${m.cls} ${compact ? 'pill--sm' : ''}`} role="status">
      <Icon name={m.icon} size={compact ? 14 : 16} strokeWidth={2.2} />
      {compact ? m.short : m.text}
    </span>
  );
}
