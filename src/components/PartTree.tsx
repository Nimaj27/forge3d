/** Liste des pièces et de leurs éléments (panneau gauche de l'éditeur). */
import { KIND_LABELS, type Scene } from '../../shared/scene';
import type { PartEvaluation } from '../geometry/types';
import { formatNumber } from '../lib/format';
import { flattenObjects } from '../scene/ops';
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

export function PartTree({ scene, evaluations, selection, activePartId, onSelect, onActivatePart, onRemovePart }: PartTreeProps) {
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
            {flattenObjects(part.objects).map(({ object, depth }) => (
              <button
                key={object.id}
                type="button"
                className="tree__item"
                aria-pressed={selection.includes(object.id)}
                style={{ paddingLeft: 22 + depth * 16 }}
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
                </span>
              </button>
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
