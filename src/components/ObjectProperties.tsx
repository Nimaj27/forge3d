/**
 * Panneau de propriétés d'un objet de scène (éditeur et atelier).
 */
import { useId } from 'react';
import { FONT_IDS, FONT_INFO, KIND_LABELS, type SceneObject, type Vec3 } from '../../shared/scene';
import { degrees, formatNumber, mm } from '../lib/format';
import { useSceneStore } from '../store/sceneStore';
import { NumberField, Segmented, SliderField, Vec3Fields } from './fields';
import { Icon } from './Icon';

const SMOOTHING = [
  { value: 96, label: 'Élevé (96 segments)' },
  { value: 64, label: 'Normal (64 segments)' },
  { value: 48, label: 'Moyen (48 segments)' },
  { value: 12, label: 'Facettes visibles (12 segments)' },
];

export function ObjectProperties({
  object,
  eyebrow = 'Forme sélectionnée',
  tiltSlider = false,
}: {
  object: SceneObject;
  eyebrow?: string;
  /** Curseur « Inclinaison » (rotation autour de X), comme dans la maquette de l'atelier */
  tiltSlider?: boolean;
}) {
  const patchParams = useSceneStore((s) => s.patchParams);
  const patchTransform = useSceneStore((s) => s.patchTransform);
  const updateObject = useSceneStore((s) => s.updateObject);
  const removeObjects = useSceneStore((s) => s.removeObjects);
  const nameId = useId();
  const set = (patch: Record<string, unknown>) => patchParams(object.id, patch);
  const t = object.transform;

  return (
    <div className="props">
      <div className="panel__title">
        <span className="eyebrow">{eyebrow}</span>
        <label htmlFor={nameId} className="sr-only">
          Nom de l’objet
        </label>
        <input
          id={nameId}
          className="props__name"
          value={object.name}
          placeholder={KIND_LABELS[object.kind]}
          onChange={(e) => updateObject(object.id, (o) => ({ ...o, name: e.target.value }))}
        />
        <span className="props__kind">{KIND_LABELS[object.kind]}</span>
      </div>

      <Segmented
        label="Type de forme"
        value={object.mode}
        onChange={(mode) => updateObject(object.id, (o) => ({ ...o, mode }))}
        options={[
          { value: 'solid', label: 'Solide' },
          { value: 'hole', label: 'Trou' },
        ]}
      />

      <KindFields object={object} set={set} />

      <Vec3Fields
        legend="Position (mm)"
        labels={['X', 'Y', 'Z']}
        value={t.position}
        min={-2000}
        max={2000}
        onChange={(position) => patchTransform(object.id, { position })}
      />
      {tiltSlider && (
        <SliderField
          label="Inclinaison"
          min={-90}
          max={90}
          step={1}
          value={t.rotation[0]}
          display={degrees(t.rotation[0])}
          onChange={(x) => patchTransform(object.id, { rotation: [x, t.rotation[1], t.rotation[2]] })}
        />
      )}
      <Vec3Fields
        legend="Rotation (degrés)"
        labels={['X', 'Y', 'Z']}
        unit="°"
        decimals={1}
        step={5}
        value={t.rotation}
        min={-360}
        max={360}
        onChange={(rotation) => patchTransform(object.id, { rotation })}
      />

      <div className="props__row">
        <button
          type="button"
          className="btn btn--sm"
          aria-pressed={!!object.hidden}
          onClick={() => updateObject(object.id, (o) => ({ ...o, hidden: !o.hidden || undefined }))}
        >
          <Icon name={object.hidden ? 'eyeOff' : 'eye'} size={16} />
          {object.hidden ? 'Masqué' : 'Visible'}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          aria-pressed={!!object.locked}
          onClick={() => updateObject(object.id, (o) => ({ ...o, locked: !o.locked || undefined }))}
        >
          <Icon name={object.locked ? 'lock' : 'unlock'} size={16} />
          {object.locked ? 'Verrouillé' : 'Libre'}
        </button>
        <button type="button" className="btn btn--sm" onClick={() => removeObjects([object.id])}>
          <Icon name="trash" size={16} />
          Supprimer
        </button>
      </div>
    </div>
  );
}

function KindFields({ object, set }: { object: SceneObject; set: (patch: Record<string, unknown>) => void }) {
  switch (object.kind) {
    case 'box': {
      const p = object.params;
      const maxR = Math.max(0, Math.min(...p.size) / 2 - 0.05);
      return (
        <>
          <Vec3Fields
            legend="Dimensions (mm)"
            labels={['Largeur', 'Profondeur', 'Hauteur']}
            value={p.size}
            min={0.1}
            max={2000}
            onChange={(size: Vec3) => set({ size })}
          />
          <SliderField
            label="Arrondi des arêtes"
            min={0}
            max={Math.min(20, maxR)}
            step={0.5}
            value={p.edgeRadius}
            display={mm(p.edgeRadius, 1, 1)}
            onChange={(edgeRadius) => set({ edgeRadius })}
          />
        </>
      );
    }
    case 'cylinder': {
      const p = object.params;
      return (
        <>
          <div className="grid-2">
            <NumberField label="Diamètre" value={p.radius * 2} min={0.2} max={2000} onChange={(d) => set({ radius: d / 2 })} />
            <NumberField label="Hauteur" value={p.height} min={0.1} max={2000} onChange={(height) => set({ height })} />
          </div>
          <SmoothingSelect value={p.segments} onChange={(segments) => set({ segments })} />
        </>
      );
    }
    case 'sphere': {
      const p = object.params;
      return (
        <>
          <NumberField label="Diamètre" value={p.radius * 2} min={0.2} max={2000} onChange={(d) => set({ radius: d / 2 })} />
          <SmoothingSelect value={p.segments} onChange={(segments) => set({ segments })} />
        </>
      );
    }
    case 'cone': {
      const p = object.params;
      return (
        <div className="grid-3">
          <NumberField compact label="Ø bas" value={p.radiusBottom * 2} min={0} max={2000} onChange={(d) => set({ radiusBottom: d / 2 })} />
          <NumberField compact label="Ø haut" value={p.radiusTop * 2} min={0} max={2000} onChange={(d) => set({ radiusTop: d / 2 })} />
          <NumberField compact label="Hauteur" value={p.height} min={0.1} max={2000} onChange={(height) => set({ height })} />
        </div>
      );
    }
    case 'tube': {
      const p = object.params;
      return (
        <div className="grid-3">
          <NumberField compact label="Ø ext." value={p.outerRadius * 2} min={0.4} max={2000} onChange={(d) => set({ outerRadius: d / 2 })} />
          <NumberField
            compact
            label="Ø int."
            value={p.innerRadius * 2}
            min={0.1}
            max={p.outerRadius * 2 - 0.2}
            onChange={(d) => set({ innerRadius: d / 2 })}
          />
          <NumberField compact label="Hauteur" value={p.height} min={0.1} max={2000} onChange={(height) => set({ height })} />
        </div>
      );
    }
    case 'text': {
      const p = object.params;
      return (
        <>
          <TextArea value={p.text} onChange={(text) => set({ text })} />
          <FontSelect value={p.font} onChange={(font) => set({ font })} />
          <SliderField
            label="Hauteur des lettres"
            min={2}
            max={40}
            step={0.1}
            value={p.capHeight}
            display={mm(p.capHeight, 1, 1)}
            onChange={(capHeight) => set({ capHeight })}
          />
          <SliderField label="Relief" min={0.4} max={6} step={0.1} value={p.depth} display={mm(p.depth, 1, 1)} onChange={(depth) => set({ depth })} />
          <Segmented
            label="Alignement"
            value={p.align}
            onChange={(align) => set({ align })}
            options={[
              { value: 'left', label: 'Gauche' },
              { value: 'center', label: 'Centré' },
              { value: 'right', label: 'Droite' },
            ]}
          />
          <SliderField
            label="Espacement des lettres"
            min={-2}
            max={6}
            step={0.1}
            value={p.letterSpacing}
            display={mm(p.letterSpacing, 1, 1)}
            onChange={(letterSpacing) => set({ letterSpacing })}
          />
          <SliderField
            label="Courbure (rayon de l’arc)"
            min={0}
            max={300}
            step={1}
            value={p.onArc ? Math.abs(p.onArc.radius) : 0}
            display={p.onArc ? mm(Math.abs(p.onArc.radius), 0) : 'Droit'}
            onChange={(r) => set({ onArc: r < 5 ? undefined : { radius: r, baselineOffset: p.onArc?.baselineOffset ?? 0 } })}
          />
        </>
      );
    }
    case 'sketch': {
      const p = object.params;
      return (
        <>
          <Segmented
            label="Opération"
            value={p.op}
            onChange={(op) => set({ op })}
            options={[
              { value: 'extrude', label: 'Extruder' },
              { value: 'revolve', label: 'Révolution' },
            ]}
          />
          {p.op === 'extrude' ? (
            <NumberField label="Hauteur d’extrusion" value={p.height} min={0.1} max={2000} onChange={(height) => set({ height })} />
          ) : (
            <>
              <SliderField label="Angle" min={10} max={360} step={5} value={p.angle} display={degrees(p.angle)} onChange={(angle) => set({ angle })} />
              <SmoothingSelect value={p.segments} onChange={(segments) => set({ segments })} />
            </>
          )}
          <p className="props__hint">{p.loops.length} contour(s) fermé(s).</p>
        </>
      );
    }
    case 'svg': {
      const p = object.params;
      return (
        <div className="grid-2">
          <NumberField label="Largeur" value={p.width} min={1} max={2000} onChange={(width) => set({ width })} />
          <NumberField label="Relief" value={p.depth} min={0.2} max={100} onChange={(depth) => set({ depth })} />
        </div>
      );
    }
    case 'image': {
      const p = object.params;
      return (
        <>
          <Segmented
            label="Mode de relief"
            value={p.mode}
            onChange={(mode) => set({ mode })}
            options={[
              { value: 'threshold', label: 'Logo (seuil)' },
              { value: 'heightmap', label: 'Photo (relief)' },
            ]}
          />
          <NumberField label="Largeur" value={p.width} min={5} max={2000} onChange={(width) => set({ width })} />
          {p.mode === 'threshold' && (
            <SliderField label="Seuil" min={1} max={254} step={1} value={p.threshold} display={formatNumber(p.threshold, 0)} onChange={(threshold) => set({ threshold })} />
          )}
          <div className="grid-2">
            <NumberField label={p.mode === 'threshold' ? 'Relief' : 'Épaisseur min.'} value={p.mode === 'threshold' ? p.maxHeight : p.minHeight} min={0.2} max={50} onChange={(v) => set(p.mode === 'threshold' ? { maxHeight: v } : { minHeight: v })} />
            {p.mode === 'heightmap' && <NumberField label="Épaisseur max." value={p.maxHeight} min={0.4} max={50} onChange={(maxHeight) => set({ maxHeight })} />}
          </div>
          <label className="check">
            <input type="checkbox" checked={p.invert} onChange={(e) => set({ invert: e.target.checked })} />
            Inverser clair / foncé
          </label>
        </>
      );
    }
    case 'group':
      return <p className="props__hint">Groupe de {object.children.length} objet(s) : les trous du groupe percent ses solides.</p>;
  }
}

function SmoothingSelect({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const id = useId();
  const options = SMOOTHING.some((o) => o.value === value) ? SMOOTHING : [...SMOOTHING, { value, label: `${value} segments` }];
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Lissage
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function FontSelect({ value, onChange }: { value: (typeof FONT_IDS)[number]; onChange: (v: (typeof FONT_IDS)[number]) => void }) {
  const id = useId();
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Police
      </label>
      <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value as (typeof FONT_IDS)[number])}>
        {FONT_IDS.map((f) => (
          <option key={f} value={f}>
            {FONT_INFO[f].label}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextArea({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  const lines = value.split('\n').length;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        Texte
      </label>
      <textarea id={id} className="textarea" rows={Math.min(4, Math.max(1, lines))} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
