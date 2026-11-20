/**
 * Atelier « Croquis 2D » : dessin coté au millimètre, symétrie, import SVG/DXF,
 * puis transformation en 3D par extrusion ou révolution et ajout à la scène.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { sceneObjectSchema, type Scene, type SceneObject, type Vec2 } from '../../shared/scene';
import { AtelierModeSwitch } from '../components/AtelierModeSwitch';
import { NumberField, Segmented, SliderField } from '../components/fields';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { useSceneView } from '../editor/useSceneView';
import { geometry } from '../geometry/client';
import { degrees, dims, formatNumber, mm } from '../lib/format';
import { exportStl } from '../lib/exporter';
import { useIsDesktop } from '../lib/useMediaQuery';
import { createObject, uniqueName } from '../scene/factory';
import { findObject, flattenObjects } from '../scene/ops';
import { importSketchFile } from '../sketch/importFile';
import { describeShapes, loopToShape, shapeToLoop, symmetrize, type PathSeg, type SketchShape } from '../sketch/model';
import { SketchCanvas, type DraftInfo, type SketchCanvasHandle } from '../sketch/SketchCanvas';
import { useSketchHistory, useSketchStore, type SketchTool } from '../sketch/sketchStore';
import { DRAW_TOOLS } from '../sketch/tools';
import { useSceneStore } from '../store/sceneStore';
import { usePrinter } from '../store/settingsStore';
import { Viewer3D } from '../viewer/Viewer3D';

const SMOOTHING = [
  { value: 96, label: 'Élevé (96 segments)' },
  { value: 48, label: 'Moyen (48 segments)' },
  { value: 12, label: 'Facettes visibles (12 segments)' },
];

export function CroquisPage() {
  const isDesktop = useIsDesktop();
  const [tool, setTool] = useState<SketchTool>('line');
  const [snap, setSnap] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [polygonSides, setPolygonSides] = useState(6);
  const [rectRadius, setRectRadius] = useState(0);
  const [wall, setWall] = useState(2.5);
  const [draft, setDraft] = useState<DraftInfo | null>(null);
  const [gridStep, setGridStep] = useState(1);
  const canvasRef = useRef<SketchCanvasHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = useSketchStore;
  const shapes = st((s) => s.shapes);
  const op = st((s) => s.op);
  const name = st((s) => s.name);
  const editingObjectId = st((s) => s.editingObjectId);
  const { canUndo, canRedo, undo, redo } = useSketchHistory();
  const navigate = useNavigate();
  useLoadFromUrl();

  const preview = useSketchPreview();

  const applySymmetry = () => {
    const { shapes: list, selectedShape } = st.getState();
    if (!list.length) return;
    const targets = selectedShape ? list.filter((s) => s.id === selectedShape) : list;
    st.getState().setShapes((all) => all.flatMap((s) => (targets.includes(s) ? symmetrize(s) : [s])));
    toast(op === 'revolve' ? 'Symétrie appliquée autour de l’axe.' : 'Symétrie appliquée (axe vertical x = 0).', 'success');
  };

  const applyShell = async () => {
    const { shapes: list, selectedShape } = st.getState();
    const targets = selectedShape ? list.filter((s) => s.id === selectedShape) : list;
    if (!targets.length) return;
    try {
      const loops = await geometry().shellSketch(targets.map(shapeToLoop), wall, op);
      const created = loops.map(loopToShape);
      st.getState().setShapes((all) => [...all.filter((s) => !targets.includes(s)), ...created]);
      st.getState().select(created[0]?.id ?? null);
      toast(op === 'revolve' ? `Paroi de ${mm(wall, 1)} créée (fond et ouverture en haut).` : `Contour creux de ${mm(wall, 1)} créé.`, 'success');
    } catch {
      toast('Impossible de creuser ce contour.', 'error');
    }
  };

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    try {
      const res = await importSketchFile(file);
      if (res.shapes.length) {
        st.getState().addShapes(res.shapes);
        setTimeout(() => canvasRef.current?.fit(), 0);
      }
      res.warnings.forEach((w) => toast(w, 'warning', 6000));
      if (res.shapes.length) toast(`${res.shapes.length} contour(s) importé(s).`, 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Fichier illisible', 'error');
    }
  };

  const addToScene = () => {
    const obj = preview.object;
    if (!obj || obj.kind !== 'sketch') return;
    const scene = useSceneStore.getState();
    const existing = editingObjectId ? findObject(scene.scene, editingObjectId) : null;
    if (existing && existing.object.kind === 'sketch') {
      scene.updateObject(editingObjectId!, (o) => ({ ...o, name: obj.name, params: obj.params }) as SceneObject);
      scene.select([editingObjectId!]);
      toast('Croquis mis à jour dans la scène.', 'success');
    } else {
      const part = scene.scene.parts.find((p) => p.id === scene.activePartId) ?? scene.scene.parts[0];
      const names = flattenObjects(part.objects).map((o) => o.object.name);
      const created = createObject('sketch', { name: uniqueName(obj.name || 'Croquis', names), params: obj.params });
      scene.addObject(created, part.id);
      st.getState().setParams({});
      useSketchStore.setState({ editingObjectId: created.id });
      toast('Croquis ajouté à la scène.', 'success');
    }
    navigate('/atelier');
  };

  const exportAlone = async () => {
    if (!preview.scene.parts[0].objects.length) return;
    try {
      const res = await exportStl(preview.scene, { zip: !isDesktop });
      toast(res.warnings.length ? `Exporté avec avertissement : ${res.warnings.join(' ')}` : 'STL exporté (maillage vérifié).', res.warnings.length ? 'warning' : 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export impossible', 'error');
    }
  };

  const onDraft = useCallback((info: DraftInfo | null) => setDraft(info), []);

  const toolsPanel = (
    <>
      <span className="eyebrow">Dessiner</span>
      <button type="button" className="tool-btn tool-btn--wide" aria-pressed={tool === 'select'} onClick={() => setTool('select')}>
        <Icon name="select" />
        Sélectionner / modifier
      </button>
      <div className="tool-grid">
        {DRAW_TOOLS.map((t) => (
          <button key={t.value} type="button" className="tool-btn" aria-pressed={tool === t.value} onClick={() => setTool(t.value)}>
            <Icon name={t.icon} />
            {t.label}
          </button>
        ))}
      </div>
      {tool === 'polygon' && <NumberField label="Nombre de côtés" unit="" decimals={0} value={polygonSides} min={3} max={64} onChange={(v) => setPolygonSides(Math.round(v))} />}
      {tool === 'rect' && <NumberField label="Arrondi des coins" value={rectRadius} min={0} max={500} onChange={setRectRadius} />}
      <span className="eyebrow">Précision</span>
      <PrecisionPanel draft={draft} tool={tool} canvas={canvasRef} />
      <div className="tool-list">
        <button type="button" className="tool-btn tool-btn--wide" aria-pressed={showDims} onClick={() => setShowDims((v) => !v)}>
          <Icon name="dimension" />
          Coter (mm exacts)
        </button>
        <button type="button" className="tool-btn tool-btn--wide" onClick={applySymmetry} disabled={!shapes.length}>
          <Icon name="symmetry" />
          Symétrie
        </button>
        <div className="shell-row">
          <button type="button" className="tool-btn tool-btn--wide" onClick={applyShell} disabled={!shapes.length} title={op === 'revolve' ? 'Transforme la silhouette en paroi de vase (fond + ouverture en haut)' : 'Transforme le contour en anneau'}>
            <Icon name="frame" />
            Creuser (paroi)
          </button>
          <NumberField compact label="Épaisseur" value={wall} min={0.4} max={50} step={0.5} decimals={2} onChange={setWall} />
        </div>
        <label className="check">
          <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
          Grille 1 mm
        </label>
      </div>
      <button type="button" className="btn btn--dashed tool-import" onClick={() => fileRef.current?.click()}>
        <Icon name="upload" />
        Importer SVG / DXF
      </button>
      <input ref={fileRef} type="file" accept=".svg,.dxf,image/svg+xml" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onImport(e.target.files?.[0])} />
    </>
  );

  const canvasHeader = (
    <div className="stage__toolbar">
      <label className="sr-only" htmlFor="sketch-name">
        Nom du croquis
      </label>
      <input id="sketch-name" className="props__name sketch-name" value={name} onChange={(e) => st.getState().setParams({ name: e.target.value })} />
      <span className="pill pill--sm">{describeShapes(shapes)}</span>
      <div className="stage__spacer" />
      <span className="sketch-grid-label">Grille : 1 carreau = {gridStep} mm</span>
      <button type="button" className="icon-btn" aria-label="Annuler" disabled={!canUndo} onClick={undo}>
        <Icon name="undo" />
      </button>
      <button type="button" className="icon-btn" aria-label="Rétablir" disabled={!canRedo} onClick={redo}>
        <Icon name="redo" />
      </button>
      <button type="button" className="icon-btn" aria-label="Cadrer le dessin" onClick={() => canvasRef.current?.fit()}>
        <Icon name="frame" />
      </button>
      <button
        type="button"
        className="icon-btn"
        aria-label="Nouveau croquis"
        onClick={() => {
          st.getState().reset();
          toast('Nouveau croquis.', 'info');
        }}
      >
        <Icon name="trash" />
      </button>
    </div>
  );

  const canvas = (
    <SketchCanvas
      tool={tool}
      snap={snap}
      showDims={showDims}
      revolve={op === 'revolve'}
      polygonSides={polygonSides}
      rectRadius={rectRadius}
      onDraft={onDraft}
      onShapeCreated={() => setTool((t) => (t === 'line' || t === 'curve' || t === 'arc' ? 'select' : t))}
      handleRef={canvasRef}
      onGridStep={setGridStep}
    />
  );

  const transformPanel = <TransformPanel preview={preview} onAdd={addToScene} onExport={exportAlone} editing={!!editingObjectId} />;

  if (!isDesktop) {
    return (
      <div className="m-croquis mobile-body">
        <header className="mobile-header">
          <span className="mobile-header__title">Atelier</span>
          <AtelierModeSwitch compact />
          <span className="stage__spacer" />
          <button type="button" className="icon-btn icon-btn--plain" aria-label="Annuler" disabled={!canUndo} onClick={undo}>
            <Icon name="undo" />
          </button>
        </header>
        <div className="m-croquis__canvas">{canvas}</div>
        <div className="shape-strip" role="group" aria-label="Outils de dessin" tabIndex={0}>
          <button type="button" className="shape-btn shape-btn--sm" aria-pressed={tool === 'select'} onClick={() => setTool('select')}>
            <Icon name="select" size={20} />
            Modifier
          </button>
          {DRAW_TOOLS.map((t) => (
            <button key={t.value} type="button" className="shape-btn shape-btn--sm" aria-pressed={tool === t.value} onClick={() => setTool(t.value)}>
              <Icon name={t.icon} size={20} />
              {t.label}
            </button>
          ))}
        </div>
        <section className="m-croquis__panel" aria-label="Précision et options">
          <PrecisionPanel draft={draft} tool={tool} canvas={canvasRef} />
          <div className="action-strip" role="group" aria-label="Options du croquis" tabIndex={0}>
            <button type="button" className="btn btn--sm" aria-pressed={showDims} onClick={() => setShowDims((v) => !v)}>
              <Icon name="dimension" size={16} />
              Cotes
            </button>
            <button type="button" className="btn btn--sm" onClick={applySymmetry} disabled={!shapes.length}>
              <Icon name="symmetry" size={16} />
              Symétrie
            </button>
            <button type="button" className="btn btn--sm" onClick={applyShell} disabled={!shapes.length}>
              <Icon name="frame" size={16} />
              Paroi {mm(wall, 1)}
            </button>
            <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={16} />
              SVG / DXF
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".svg,.dxf,image/svg+xml" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onImport(e.target.files?.[0])} />
          {transformPanel}
        </section>
      </div>
    );
  }

  return (
    <div className="workspace workspace--sketch">
      <aside className="panel panel--left" aria-label="Outils de croquis">
        {toolsPanel}
      </aside>
      <section className="stage" aria-label="Plan de croquis">
        {canvasHeader}
        <div className="sketch-paper">{canvas}</div>
        <p className="sketch-help">
          {tool === 'select'
            ? 'Glissez les carrés pour déplacer les points, les ronds pour courber un segment. Suppr efface le point ou la forme.'
            : tool === 'circle' || tool === 'rect' || tool === 'polygon'
              ? 'Cliquez pour placer le premier point, puis le second (ou saisissez la cote à gauche).'
              : 'Cliquez pour poser les points ; cliquez sur le premier point (ou Entrée) pour fermer le contour. Glisser déplace la vue.'}
        </p>
      </section>
      <aside className="panel panel--right" aria-label="Transformer en 3D">
        {transformPanel}
      </aside>
    </div>
  );
}

/** Charge l'objet croquis indiqué dans l'URL (?objet=…) pour le modifier. */
function useLoadFromUrl() {
  const [params] = useSearchParams();
  const id = params.get('objet');
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!id || loaded.current === id) return;
    loaded.current = id;
    const found = findObject(useSceneStore.getState().scene, id);
    if (found?.object.kind === 'sketch') useSketchStore.getState().loadObject(found.object);
  }, [id]);
}

/** Objet de scène et scène d'aperçu construits à partir du croquis. */
function useSketchPreview() {
  const shapes = useSketchStore((s) => s.shapes);
  const op = useSketchStore((s) => s.op);
  const height = useSketchStore((s) => s.height);
  const angle = useSketchStore((s) => s.angle);
  const segments = useSketchStore((s) => s.segments);
  const name = useSketchStore((s) => s.name);
  const printer = usePrinter();

  const object = useMemo<SceneObject | null>(() => {
    if (!shapes.length) return null;
    try {
      return sceneObjectSchema.parse({ id: 'apercu-croquis', name, kind: 'sketch', params: { loops: shapes.map(shapeToLoop), op, height, angle, segments } });
    } catch {
      return null;
    }
  }, [shapes, op, height, angle, segments, name]);

  const scene = useMemo<Scene>(
    () => ({
      version: 1,
      name: name || 'Croquis',
      unit: 'mm',
      printer: { id: printer.id, bed: printer.bed },
      layerHeight: 0.2,
      firstLayerHeight: 0.2,
      parts: [{ id: 'apercu-croquis', name: name || 'Croquis', objects: object ? [object] : [] }],
    }),
    [object, name, printer],
  );
  const view = useSceneView(scene, printer.bed);
  return { object, scene, view, bed: printer.bed };
}

function TransformPanel({ preview, onAdd, onExport, editing }: { preview: ReturnType<typeof useSketchPreview>; onAdd: () => void; onExport: () => void; editing: boolean }) {
  const op = useSketchStore((s) => s.op);
  const height = useSketchStore((s) => s.height);
  const angle = useSketchStore((s) => s.angle);
  const segments = useSketchStore((s) => s.segments);
  const setParams = useSketchStore((s) => s.setParams);
  const ev = preview.view.evaluations['apercu-croquis'];
  const report = preview.view.reports['apercu-croquis'];
  const b = ev?.bounds;
  const overhang = report?.checks.find((c) => c.id === 'overhang');
  const manifold = report?.checks.find((c) => c.id === 'manifold');

  let result = 'Dessinez un contour fermé.';
  if (ev?.status === 'error') result = `Erreur : ${ev.error}`;
  else if (b) {
    const size = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]];
    const round = op === 'revolve' && angle >= 360 && Math.abs(size[0] - size[1]) < 0.2;
    result = `Résultat : ${round ? `Ø ${formatNumber(size[0], 1)} × ${mm(size[2], 1)}` : dims(size)}`;
    if (overhang) result += overhang.level === 'ok' ? ', sans support' : ', supports probablement nécessaires';
  }

  return (
    <>
      <div className="panel__title">
        <span className="eyebrow">Transformer en 3D</span>
        <span className="panel__heading">{op === 'revolve' ? 'Révolution' : 'Extrusion'}</span>
      </div>
      <Segmented
        label="Opération"
        value={op}
        onChange={(v) => setParams({ op: v })}
        options={[
          { value: 'extrude', label: 'Extruder' },
          { value: 'revolve', label: 'Révolution' },
        ]}
      />
      {op === 'extrude' ? (
        <NumberField label="Hauteur d’extrusion" value={height} min={0.2} max={1000} onChange={(v) => setParams({ height: v })} />
      ) : (
        <>
          <SliderField label="Angle" min={10} max={360} step={5} value={angle} display={degrees(angle)} onChange={(v) => setParams({ angle: v })} />
          <div className="field">
            <label className="field__label" htmlFor="sketch-smoothing">
              Lissage
            </label>
            <select id="sketch-smoothing" className="select" value={segments} onChange={(e) => setParams({ segments: Number(e.target.value) })}>
              {SMOOTHING.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div className="sketch-preview">
        <Viewer3D items={preview.view.items} layout="assembly" bed={preview.bed} view="iso" frameKey={`${op}-${preview.object ? 1 : 0}`} label="Aperçu 3D du croquis" />
      </div>
      <span className="props__hint" role="status">
        {result}
        {manifold && manifold.level !== 'ok' ? ` · ${manifold.message}` : ''}
      </span>
      <div className="export-actions">
        <button type="button" className="btn btn--primary btn--lg btn--block" onClick={onAdd} disabled={!preview.object || ev?.status !== 'ok'}>
          <Icon name={editing ? 'check' : 'plus'} />
          {editing ? 'Mettre à jour dans la scène' : 'Ajouter à la scène'}
        </button>
        <button type="button" className="btn btn--block" onClick={onExport} disabled={!preview.object || ev?.status !== 'ok'}>
          <Icon name="download" />
          Exporter seul en STL
        </button>
      </div>
    </>
  );
}

/** Saisie exacte : longueur et angle du prochain segment, coordonnées d'un point, paramètres d'une forme. */
function PrecisionPanel({ draft, tool, canvas }: { draft: DraftInfo | null; tool: SketchTool; canvas: React.RefObject<SketchCanvasHandle | null> }) {
  const [length, setLength] = useState(10);
  const [angle, setAngle] = useState(0);
  const [abs, setAbs] = useState<Vec2>([0, 0]);
  const selectedShape = useSketchStore((s) => s.selectedShape);
  const selectedVertex = useSketchStore((s) => s.selectedVertex);
  const shape = useSketchStore((s) => s.shapes.find((x) => x.id === s.selectedShape) ?? null);
  const update = (fn: (s: SketchShape) => SketchShape) => selectedShape && useSketchStore.getState().updateShape(selectedShape, fn);

  // Dessin en cours : longueur / angle depuis le dernier point
  if (tool !== 'select') {
    const primitive = tool === 'circle' || tool === 'rect' || tool === 'polygon';
    const hasLast = !!draft?.last;
    return (
      <div className="precision card">
        {draft?.cursor && (
          <span className="props__hint">
            Curseur {formatNumber(draft.cursor[0], 1)} ; {formatNumber(draft.cursor[1], 1)}
            {draft.length !== null && ` · ${mm(draft.length, 1)} à ${degrees(draft.angle ?? 0)}`}
          </span>
        )}
        {!hasLast ? (
          <>
            <span className="props__hint">{primitive ? 'Point de départ (centre ou coin) :' : 'Premier point :'}</span>
            <div className="grid-2">
              <NumberField compact label="X" value={abs[0]} onChange={(v) => setAbs([v, abs[1]])} />
              <NumberField compact label="Y" value={abs[1]} onChange={(v) => setAbs([abs[0], v])} />
            </div>
            <button type="button" className="btn btn--sm" onClick={() => canvas.current?.addAbsolute(abs)}>
              Placer le point
            </button>
          </>
        ) : (
          <>
            <div className="grid-2">
              <NumberField compact label={tool === 'circle' || tool === 'polygon' ? 'Rayon' : 'Longueur'} value={length} min={0.1} max={2000} onChange={setLength} />
              <NumberField compact label="Angle" unit="°" decimals={1} value={angle} min={-360} max={360} step={15} onChange={setAngle} />
            </div>
            <div className="props__row">
              <button type="button" className="btn btn--sm btn--primary" onClick={() => canvas.current?.addRelative(length, angle)}>
                {primitive ? 'Valider' : 'Ajouter le point'}
              </button>
              {!primitive && (
                <>
                  <button type="button" className="btn btn--sm" onClick={() => canvas.current?.undoPoint()}>
                    Retirer
                  </button>
                  <button type="button" className="btn btn--sm" onClick={() => canvas.current?.close()} disabled={(draft?.points ?? 0) < 3}>
                    Fermer
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  if (!shape) return <p className="props__hint">Sélectionnez une forme ou un point pour saisir ses cotes exactes.</p>;

  if (shape.kind === 'path') {
    const i = selectedVertex;
    if (i === null || i >= shape.points.length)
      return <p className="props__hint">Chemin de {shape.points.length} points. Touchez un point (carré) pour le coter.</p>;
    const p = shape.points[i];
    const seg = shape.segs[i];
    const setSeg = (t: PathSeg['t']) =>
      update((s) =>
        s.kind === 'path'
          ? { ...s, segs: s.segs.map((g, k) => (k === i ? (t === 'arc' ? { t: 'arc', bulge: g.t === 'arc' ? g.bulge : Math.tan(Math.PI / 8) } : t === 'curve' ? { t: 'curve' } : { t: 'line' }) : g)) }
          : s,
      );
    return (
      <div className="precision card">
        <span className="card__title">Point {i + 1}</span>
        <div className="grid-2">
          <NumberField compact label="X" value={p[0]} onChange={(v) => update((s) => (s.kind === 'path' ? { ...s, points: s.points.map((q, k) => (k === i ? [v, q[1]] : q)) } : s))} />
          <NumberField compact label="Y" value={p[1]} onChange={(v) => update((s) => (s.kind === 'path' ? { ...s, points: s.points.map((q, k) => (k === i ? [q[0], v] : q)) } : s))} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="seg-type">
            Segment suivant
          </label>
          <select id="seg-type" className="select" value={seg.t === 'bezier' ? 'curve' : seg.t} onChange={(e) => setSeg(e.target.value as PathSeg['t'])}>
            <option value="line">Ligne</option>
            <option value="arc">Arc</option>
            <option value="curve">Courbe</option>
          </select>
        </div>
        <div className="props__row">
          <button
            type="button"
            className="btn btn--sm"
            onClick={() =>
              update((s) => {
                if (s.kind !== 'path') return s;
                const a = s.points[i];
                const b = s.points[(i + 1) % s.points.length];
                const mid: Vec2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
                const points = [...s.points.slice(0, i + 1), mid, ...s.points.slice(i + 1)];
                const segs = [...s.segs.slice(0, i + 1), s.segs[i], ...s.segs.slice(i + 1)];
                return { ...s, points, segs };
              })
            }
          >
            Insérer un point après
          </button>
          <button
            type="button"
            className="btn btn--sm"
            disabled={shape.points.length <= 3}
            onClick={() => {
              update((s) => (s.kind === 'path' ? { ...s, points: s.points.filter((_, k) => k !== i), segs: s.segs.filter((_, k) => k !== i) } : s));
              useSketchStore.getState().select(shape.id, null);
            }}
          >
            Supprimer le point
          </button>
        </div>
      </div>
    );
  }

  const center = (
    <div className="grid-2">
      <NumberField compact label="Centre X" value={shape.c[0]} onChange={(v) => update((s) => (s.kind !== 'path' ? { ...s, c: [v, s.c[1]] } : s))} />
      <NumberField compact label="Centre Y" value={shape.c[1]} onChange={(v) => update((s) => (s.kind !== 'path' ? { ...s, c: [s.c[0], v] } : s))} />
    </div>
  );
  return (
    <div className="precision card">
      {shape.kind === 'circle' && <NumberField label="Diamètre" value={shape.r * 2} min={0.2} max={2000} onChange={(d) => update((s) => (s.kind === 'circle' ? { ...s, r: d / 2 } : s))} />}
      {shape.kind === 'rect' && (
        <>
          <div className="grid-2">
            <NumberField compact label="Largeur" value={shape.w} min={0.2} max={2000} onChange={(w) => update((s) => (s.kind === 'rect' ? { ...s, w } : s))} />
            <NumberField compact label="Hauteur" value={shape.h} min={0.2} max={2000} onChange={(h) => update((s) => (s.kind === 'rect' ? { ...s, h } : s))} />
          </div>
          <NumberField label="Arrondi des coins" value={shape.r} min={0} max={1000} onChange={(r) => update((s) => (s.kind === 'rect' ? { ...s, r } : s))} />
        </>
      )}
      {shape.kind === 'polygon' && (
        <div className="grid-2">
          <NumberField compact label="Rayon" value={shape.r} min={0.2} max={2000} onChange={(r) => update((s) => (s.kind === 'polygon' ? { ...s, r } : s))} />
          <NumberField compact label="Côtés" unit="" decimals={0} value={shape.n} min={3} max={64} onChange={(n) => update((s) => (s.kind === 'polygon' ? { ...s, n: Math.round(n) } : s))} />
        </div>
      )}
      {center}
      <button type="button" className="btn btn--sm" onClick={() => useSketchStore.getState().removeShape(shape.id)}>
        <Icon name="trash" size={16} />
        Supprimer la forme
      </button>
    </div>
  );
}
