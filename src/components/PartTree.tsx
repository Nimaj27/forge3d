/** Liste des pièces et de leurs éléments (panneau gauche de l'éditeur). */
import { useState } from 'react';
import { KIND_LABELS, type Scene, type SceneObject } from '../../shared/scene';
import type { PartEvaluation } from '../geometry/types';
import { formatNumber } from '../lib/format';
import { Icon } from './Icon';

interface PartTreeProps {
  scene: Scene;
  evaluations: Record<string, PartEvaluation>;
  selection: string[];
  activePartId: string;
  onSelect: (id: string, additive: boolean) => void;
  onActivatePart: (partId: string) => void;
  onRemovePart?: (partId: string) => void;
}

/** Liste à plat ; les groupes de plus de 6 éléments sont repliés par défaut. */
function visibleObjects(list: readonly SceneObject[], expanded: Set<string>, collapsed: Set<string>, depth = 0): { object: SceneObject; depth: number; open: boolean | null }[] {
  const out: { object: SceneObject; depth: number; open: boolean | null }[] = [];
  for (const o of list) {
    if (o.kind !== 'group') {
      out.push({ object: o, depth, open: null });
      continue;
    }
    const open = expanded.has(o.id) || (!collapsed.has(o.id) && o.children.length <= 6);
    out.push({ object: o, depth, open });
    if (open) out.push(...visibleObjects(o.children, expanded, collapsed, depth + 1));
  }
  return out;
}

export function PartTree({ scene, evaluations, selection, activePartId, onSelect, onActivatePart, onRemovePart }: PartTreeProps) {
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [collapsed, setCollapsed] = useState(() => new Set<string>());
  const toggle = (id: string, open: boolean) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (open) n.delete(id);
      else n.add(id);
      return n;
    });
    setCollapsed((s) => {
      const n = new Set(s);
      if (open) n.add(id);
      else n.delete(id);
      return n;
    });
  };
  return (
    <div className="tree" role="list" aria-label="Pièces et éléments">
      {scene.parts.map((part) => {
        const ev = evaluations[part.id];
        const pb = ev?.printBounds;
        const size = pb ? [pb.max[0] - pb.min[0], pb.max[1] - pb.min[1], pb.max[2] - pb.min[2]] : null;
        const active = part.id === activePartId && scene.parts.length > 1;
        return (
          <div key={part.id} role="listitem" className="tree__part">
            <div className="tree__head">
              <button
                type="button"
                className={`tree__part-btn ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => onActivatePart(part.id)}
                title="Pièce active : les ajouts s’y placent"
              >
                {part.name}
              </button>
              <span className="tree__meta">{size ? size.map((v) => formatNumber(v, 1)).join(' × ') : '—'}</span>
              {onRemovePart && scene.parts.length > 1 && (
                <button type="button" className="icon-btn icon-btn--plain" style={{ width: 36, height: 36 }} aria-label={`Supprimer la pièce ${part.name}`} onClick={() => onRemovePart(part.id)}>
                  <Icon name="trash" size={16} />
                </button>
              )}
            </div>
            {part.objects.length === 0 && <p className="tree__empty">Pièce vide : ajoutez une forme ou un texte.</p>}
            {visibleObjects(part.objects, expanded, collapsed).map(({ object, depth, open }) => (
              <div key={object.id} className="tree__row" style={{ paddingLeft: depth * 16 }}>
              {open !== null && (
                <button
                  type="button"
                  className="tree__toggle"
                  aria-expanded={open}
                  aria-label={`${open ? 'Replier' : 'Déplier'} ${object.name}`}
                  onClick={() => toggle(object.id, open)}
                >
                  <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
                </button>
              )}
              <button
                type="button"
                className="tree__item"
                aria-pressed={selection.includes(object.id)}
                onClick={(e) => onSelect(object.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              >
                <span className="tree__label">
                  {object.mode === 'hole' && <Icon name="hole" size={14} />}
                  {object.hidden && <Icon name="eyeOff" size={14} />}
                  {object.name || KIND_LABELS[object.kind]}
                </span>
                <span className="tree__meta">
                  {KIND_LABELS[object.kind]}
                  {object.mode === 'hole' ? ' · trou' : ''}
                  {object.kind === 'group' && !open ? ` · ${object.children.length}` : ''}
                </span>
              </button>
              </div>
            ))}
            {ev?.warnings.map((w) => (
              <p key={w} className="tree__warning">
                <Icon name="warning" size={14} /> {w}
              </p>
            ))}
            {ev?.status === 'error' && (
              <p className="tree__warning">
                <Icon name="error" size={14} /> {ev.error}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
