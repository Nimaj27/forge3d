/** Barre « Couleurs par couche » : tranches, pauses et couleurs d'une pièce. */
import { useId, useState } from 'react';
import type { Part, Scene } from '../../shared/scene';
import { mm, parseNumber } from '../lib/format';
import { colorBands, pauseHeights } from '../lib/layers';
import { useSettings } from '../store/settingsStore';
import { Icon } from './Icon';

const COLOR_NAMES: Record<string, string> = {
  '#9a9da2': 'Gris',
  '#d6a838': 'Or',
  '#ffffff': 'Blanc',
  '#000000': 'Noir',
  '#1a1a1a': 'Noir',
  '#c0392b': 'Rouge',
  '#2e86de': 'Bleu',
  '#27ae60': 'Vert',
};

export function colorName(hex: string, index: number): string {
  return COLOR_NAMES[hex.toLowerCase()] ?? `Couleur ${index + 1}`;
}

interface ColorBarProps {
  scene: Scene;
  part: Part;
  /** Hauteur de la pièce dans l'orientation d'impression */
  height: number | null;
  onChange: (part: Part) => void;
  compact?: boolean;
}

export function ColorBar({ scene, part, height, onChange, compact }: ColorBarProps) {
  const filaments = useSettings((s) => s.filaments);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputId = useId();
  const pauses = pauseHeights(part.colorChanges, scene.firstLayerHeight, scene.layerHeight);
  const bands = colorBands(pauses, scene.layerHeight, part.colors, filaments);

  const setColor = (i: number, color: string) => {
    const colors = bands.map((b) => b.color);
    colors[i] = color;
    onChange({ ...part, colors });
  };
  const removePause = (i: number) => {
    // i = index de la tranche (≥ 1) ; on retire le changement correspondant
    const changes = [...(part.colorChanges ?? [])].sort((a, b) => a - b);
    changes.splice(i - 1, 1);
    const colors = bands.map((b) => b.color);
    colors.splice(i, 1);
    onChange({ ...part, colorChanges: changes.length ? changes : undefined, colors: changes.length ? colors : undefined });
  };
  const addPause = () => {
    const z = parseNumber(draft);
    if (!Number.isFinite(z) || z <= 0) return;
    const changes = [...(part.colorChanges ?? []), z].sort((a, b) => a - b);
    onChange({ ...part, colorChanges: changes, colors: undefined });
    setAdding(false);
    setDraft('');
  };

  return (
    <div className={`colorbar ${compact ? 'colorbar--compact' : ''}`}>
      <span className="colorbar__title">Couleurs par couche</span>
      {bands.map((b, i) => (
        <span key={i} className="colorbar__band">
          <label className="colorbar__swatch" title="Changer la couleur">
            <span className="swatch" style={{ background: b.color }} />
            <input type="color" className="sr-only" value={b.color} onChange={(e) => setColor(i, e.target.value)} aria-label={`Couleur de la tranche ${i + 1}`} />
          </label>
          <span>
            {colorName(b.color, i)}{' '}
            {i === 0
              ? pauses.length
                ? `0 → ${mm(b.to, 1)}`
                : 'sur toute la hauteur'
              : `à partir de ${mm(b.pauseAt ?? 0, 1)}`}
          </span>
          {i > 0 && (
            <button type="button" className="icon-btn icon-btn--plain colorbar__remove" aria-label={`Supprimer la pause à ${mm(b.pauseAt ?? 0, 1)}`} onClick={() => removePause(i)}>
              <Icon name="close" size={14} />
            </button>
          )}
        </span>
      ))}
      <span className="stage__spacer" />
      {adding ? (
        <form
          className="colorbar__add"
          onSubmit={(e) => {
            e.preventDefault();
            addPause();
          }}
        >
          <label htmlFor={inputId} className="sr-only">
            Hauteur du changement de couleur en millimètres
          </label>
          <input
            id={inputId}
            className="input input--num"
            style={{ width: 110, minHeight: 40 }}
            inputMode="decimal"
            placeholder={height ? `0 à ${Math.floor(height)}` : 'Z en mm'}
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="btn btn--sm btn--primary">
            Ajouter
          </button>
          <button type="button" className="btn btn--sm" onClick={() => setAdding(false)}>
            Annuler
          </button>
        </form>
      ) : (
        <button type="button" className="btn btn--sm" onClick={() => setAdding(true)}>
          <Icon name="pause" size={16} />
          Ajouter une pause
        </button>
      )}
      {pauses.length > 0 && (
        <span className="colorbar__pauses">
          {pauses.map((p) => (
            <span key={p} className="pill pill--sm">
              Pause à {mm(p, 1)}
            </span>
          ))}
        </span>
      )}
    </div>
  );
}
