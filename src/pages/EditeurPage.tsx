/**
 * Éditeur : pièces et éléments (gauche), aperçu 3D sur le plateau (centre),
 * propriétés, vérifications et export (droite). Version téléphone : tiroir à onglets.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { newId, type Part } from '../../shared/scene';
import { ChecksPanel, StatusPill } from '../components/ChecksPanel';
import { ColorBar } from '../components/ColorBar';
import { ExportButton, useExport, useExportLabel } from '../components/ExportButton';
import { Segmented } from '../components/fields';
import { Icon } from '../components/Icon';
import { ObjectProperties } from '../components/ObjectProperties';
import { PartTree } from '../components/PartTree';
import { toast } from '../components/Toast';
import { applyFix, useSceneView } from '../editor/useSceneView';
import type { CheckFix } from '../geometry/types';
import { useObjectEvaluation } from '../geometry/useEvaluation';
import { dims, formatNumber, mm, volumeCm3 } from '../lib/format';
import { useIsDesktop } from '../lib/useMediaQuery';
import { createObject, uniqueName } from '../scene/factory';
import { findObject, flattenObjects } from '../scene/ops';
import { useHistory, useSceneStore, useSelectedObject } from '../store/sceneStore';
import { usePrinter } from '../store/settingsStore';
import { worldMatrixOf } from '../viewer/math';
import { Viewer3D, type ViewPreset } from '../viewer/Viewer3D';
import { readImageFile } from '../lib/imageFile';

type ViewChoice = 'iso' | 'face' | 'plateau';

export function EditeurPage() {
  const isDesktop = useIsDesktop();
  const scene = useSceneStore((s) => s.scene);
  const selection = useSceneStore((s) => s.selection);
  const activePartId = useSceneStore((s) => s.activePartId);
  const sceneVersion = useSceneStore((s) => s.sceneVersion);
  const printer = usePrinter();
  const view = useSceneView(scene, printer.bed);
  const [viewChoice, setViewChoice] = useState<ViewChoice>('iso');
  const selected = useSelectedObject();
  const overlayEval = useObjectEvaluation(selected);
  const [params] = useSearchParams();
  useTemplateFromUrl(params.get('modele'));
  useEditorShortcuts();

  const overlay = useMemo(() => {
    if (!selected || !overlayEval?.mesh) return null;
    const m = worldMatrixOf(scene, selected.id);
    const part = findObject(scene, selected.id)?.part;
    if (!m || !part) return null;
    return { mesh: overlayEval.mesh, matrix: m, partId: part.id };
  }, [selected, overlayEval, scene]);

  const layout = viewChoice === 'plateau' ? 'print' : 'assembly';
  const preset: ViewPreset = viewChoice === 'face' ? 'face' : 'iso';
  const activePart = scene.parts.find((p) => p.id === activePartId) ?? scene.parts[0];

  const onFix = (partId: string, fix: CheckFix) => {
    useSceneStore.getState().updatePart(partId, (p) => applyFix(p, fix, view.evaluations[partId]));
  };

  const viewer = (
    <Viewer3D
      items={view.items}
      layout={layout}
      bed={printer.bed}
      view={preset}
      frameKey={`${sceneVersion}`}
      overlay={overlay}
      onBackgroundClick={() => useSceneStore.getState().select([])}
      label={`Aperçu 3D de « ${scene.name} »`}
    />
  );

  if (!isDesktop) return <MobileEditor viewer={viewer} view={view} viewChoice={viewChoice} setViewChoice={setViewChoice} onFix={onFix} />;

  const b = view.bounds;
  return (
    <div className="workspace">
      <aside className="panel panel--left" aria-label="Pièces du projet">
        <ProjectHeading />
        <PartTree
          scene={scene}
          evaluations={view.evaluations}
          selection={selection}
          activePartId={activePartId}
          onSelect={(id, additive) => (additive ? useSceneStore.getState().toggleSelect(id) : useSceneStore.getState().select([id]))}
          onActivatePart={(id) => {
            useSceneStore.getState().setActivePart(id);
            useSceneStore.getState().select([]);
          }}
          onRemovePart={(id) => useSceneStore.getState().update((s) => ({ ...s, parts: s.parts.filter((p) => p.id !== id) }))}
        />
        <AddButtons />
      </aside>

      <section className="stage" aria-label="Aperçu 3D">
        <div className="stage__toolbar">
          <ViewSwitch value={viewChoice} onChange={setViewChoice} />
          <UndoRedo />
          <div className="stage__spacer" />
          {view.evaluating && <span className="spinner" aria-label="Calcul en cours" />}
          <StatusPill level={view.status} />
        </div>
        <div className="viewer-frame">
          {viewer}
          <span className="viewer-badge viewer-badge--tl">
            Plateau {formatNumber(printer.bed[0], 0)} × {formatNumber(printer.bed[1], 0)} mm
          </span>
          {b && layout === 'assembly' && (
            <span className="viewer-badge viewer-badge--tr">
              {scene.parts.length > 1 ? 'Assemblé' : 'Dimensions'} : {dims([b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]])}
            </span>
          )}
          {layout === 'print' && <span className="viewer-badge viewer-badge--tr">Orientation d’impression</span>}
          {scene.parts.every((p) => p.objects.length === 0) && <EmptyHint />}
        </div>
        {activePart && (
          <ColorBar
            scene={scene}
            part={activePart}
            height={heightOf(view.evaluations[activePart.id]?.printBounds)}
            onChange={(p) => useSceneStore.getState().updatePart(p.id, () => p)}
          />
        )}
      </section>

      <aside className="panel panel--right" aria-label="Propriétés">
        {selected ? <ObjectProperties object={selected} eyebrow="Propriétés" /> : activePart && <PartProperties part={activePart} view={view} />}
        <ChecksPanel parts={scene.parts.filter((p) => p.objects.length)} reports={view.reports} checking={view.checking} onFix={onFix} />
        <ExportActions />
      </aside>
    </div>
  );
}

function heightOf(b: { min: number[]; max: number[] } | null | undefined): number | null {
  return b ? b.max[2] - b.min[2] : null;
}

function ProjectHeading() {
  const scene = useSceneStore((s) => s.scene);
  const rename = useSceneStore((s) => s.rename);
  return (
    <div className="panel__title">
      <span className="eyebrow">Projet</span>
      <label className="sr-only" htmlFor="project-name">
        Nom du projet
      </label>
      <input id="project-name" className="props__name props__name--lg" value={scene.name} onChange={(e) => rename(e.target.value)} />
      <span className="props__kind">
        {scene.parts.length} pièce{scene.parts.length > 1 ? 's' : ''} · {flattenObjects(scene.parts.flatMap((p) => p.objects)).length} élément(s)
      </span>
    </div>
  );
}

function ViewSwitch({ value, onChange }: { value: ViewChoice; onChange: (v: ViewChoice) => void }) {
  return (
    <div role="group" aria-label="Vues" className="segmented">
      {(
        [
          ['iso', '3/4'],
          ['face', 'Face'],
          ['plateau', 'Plateau'],
        ] as const
      ).map(([v, label]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function UndoRedo() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <div className="toolbar-pair">
      <button type="button" className="icon-btn" aria-label="Annuler" title="Annuler (Ctrl+Z)" disabled={!canUndo} onClick={undo}>
        <Icon name="undo" />
      </button>
      <button type="button" className="icon-btn" aria-label="Rétablir" title="Rétablir (Ctrl+Maj+Z)" disabled={!canRedo} onClick={redo}>
        <Icon name="redo" />
      </button>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="viewer-empty">
      <p>La pièce est vide.</p>
      <p>
        Ajoutez une forme, un texte, ou partez d’un <Link to="/modeles">modèle</Link>.
      </p>
    </div>
  );
}

/** Boutons d'ajout : Texte, Image / logo, Forme, Pièce. */
function AddButtons() {
  const fileRef = useRef<HTMLInputElement>(null);
  const add = (kind: 'text' | 'box') => {
    const { scene, activePartId, addObject } = useSceneStore.getState();
    const part = scene.parts.find((p) => p.id === activePartId) ?? scene.parts[0];
    const names = flattenObjects(part.objects).map((o) => o.object.name);
    const top = topOf(part);
    if (kind === 'text') {
      // posé sur le dessus, encastré de 0,5 mm (pas de faces coplanaires)
      addObject(createObject('text', { name: uniqueName('Texte', names), position: [0, 0, top > 0 ? top - 0.5 : 0] }), part.id);
    } else {
      addObject(createObject('box', { name: uniqueName('Cube', names), position: [0, 0, 0] }), part.id);
    }
  };
  const addPart = () => {
    const { scene, update, setActivePart } = useSceneStore.getState();
    const id = newId('p');
    const name = uniqueName(`Pièce ${scene.parts.length + 1}`, scene.parts.map((p) => p.name));
    update((s) => ({ ...s, parts: [...s.parts, { id, name, objects: [] }] }));
    setActivePart(id);
  };
  const onImage = async (file: File | undefined) => {
    if (!file) return;
    try {
      const src = await readImageFile(file);
      const { scene, activePartId, addObject } = useSceneStore.getState();
      const part = scene.parts.find((p) => p.id === activePartId) ?? scene.parts[0];
      const top = topOf(part);
      addObject(
        createObject('image', {
          name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Image',
          position: [0, 0, top > 0 ? top - 0.5 : 0],
          params: { src, width: 40, mode: 'threshold', maxHeight: top > 0 ? 1.5 : 2 },
        }),
        part.id,
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Image illisible', 'error');
    }
  };
  return (
    <div className="grid-2">
      <button type="button" className="btn btn--dashed" onClick={() => add('text')}>
        <Icon name="text" size={16} />
        Texte
      </button>
      <button type="button" className="btn btn--dashed" onClick={() => fileRef.current?.click()}>
        <Icon name="image" size={16} />
        Image / logo
      </button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => onImage(e.target.files?.[0])} />
      <button type="button" className="btn btn--dashed" onClick={() => add('box')}>
        <Icon name="shape" size={16} />
        Forme
      </button>
      <button type="button" className="btn btn--dashed" onClick={addPart}>
        <Icon name="plus" size={16} />
        Pièce
      </button>
    </div>
  );
}

/** Sommet approximatif d'une pièce (pour poser un texte dessus). */
function topOf(part: Part): number {
  let top = 0;
  for (const { object } of flattenObjects(part.objects)) {
    if (object.mode === 'hole') continue;
    const z = object.transform.position[2];
    const p = object.params as Record<string, unknown>;
    const h =
      (Array.isArray(p.size) ? (p.size[2] as number) : 0) ||
      (typeof p.height === 'number' ? p.height : 0) ||
      (typeof p.depth === 'number' ? p.depth : 0) ||
      (typeof p.radius === 'number' ? p.radius * 2 : 0);
    top = Math.max(top, z + h);
  }
  return top;
}

function PartProperties({ part, view }: { part: Part; view: ReturnType<typeof useSceneView> }) {
  const updatePart = useSceneStore((s) => s.updatePart);
  const ev = view.evaluations[part.id];
  const pb = ev?.printBounds;
  return (
    <div className="props">
      <div className="panel__title">
        <span className="eyebrow">Pièce</span>
        <label className="sr-only" htmlFor="part-name">
          Nom de la pièce
        </label>
        <input id="part-name" className="props__name" value={part.name} onChange={(e) => updatePart(part.id, (p) => ({ ...p, name: e.target.value }))} />
        <span className="props__kind">Sélectionnez un élément pour le modifier.</span>
      </div>
      <Segmented
        label="Orientation d’impression"
        value={part.printOrientation ?? 'asModeled'}
        onChange={(printOrientation) => updatePart(part.id, (p) => ({ ...p, printOrientation }))}
        options={[
          { value: 'asModeled', label: 'Telle quelle' },
          { value: 'flatOnBack', label: 'Couchée sur le dos' },
        ]}
      />
      {pb && ev && (
        <dl className="stats">
          <dt>Dimensions d’impression</dt>
          <dd>{dims([pb.max[0] - pb.min[0], pb.max[1] - pb.min[1], pb.max[2] - pb.min[2]])}</dd>
          <dt>Volume</dt>
          <dd>{volumeCm3(ev.volume)}</dd>
          <dt>Filament (PLA, plein)</dt>
          <dd>≈ {formatNumber((ev.volume / 1000) * 1.24, 0)} g</dd>
          <dt>Triangles</dt>
          <dd>{formatNumber(ev.triangleCount, 0)}</dd>
          <dt>Calcul</dt>
          <dd>{formatNumber(ev.durationMs, 0)} ms</dd>
        </dl>
      )}
    </div>
  );
}

function ExportActions() {
  const label = useExportLabel();
  const { busy, exportProject } = useExport();
  return (
    <div className="export-actions">
      <ExportButton label={label} size="lg" className="btn--block" />
      <button type="button" className="btn btn--block" onClick={exportProject} disabled={busy}>
        <Icon name="zip" />
        Télécharger le projet (.zip)
      </button>
    </div>
  );
}

/** Raccourcis clavier : annuler, rétablir, supprimer, échap. */
function useEditorShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.closest('input, textarea, select, [contenteditable="true"]') || target.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const temporal = useSceneStore.temporal.getState();
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) temporal.redo();
        else temporal.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        temporal.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection, removeObjects, scene } = useSceneStore.getState();
        const removable = selection.filter((id) => !findObject(scene, id)?.object.locked);
        if (removable.length) {
          e.preventDefault();
          removeObjects(removable);
        }
      } else if (e.key === 'Escape') {
        useSceneStore.getState().select([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Ouvre un modèle paramétrique passé dans l'URL (?modele=…). Complété au jalon J4. */
function useTemplateFromUrl(id: string | null) {
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!id || loaded.current === id) return;
    loaded.current = id;
    void import('../templates/registry').then(({ loadTemplate }) => loadTemplate(id)).catch(() => undefined);
  }, [id]);
}

// ---------------------------------------------------------------------------
// Téléphone
// ---------------------------------------------------------------------------

type MobileTab = 'elements' | 'proprietes' | 'impression';

function MobileEditor({
  viewer,
  view,
  viewChoice,
  setViewChoice,
  onFix,
}: {
  viewer: ReactNode;
  view: ReturnType<typeof useSceneView>;
  viewChoice: ViewChoice;
  setViewChoice: (v: ViewChoice) => void;
  onFix: (partId: string, fix: CheckFix) => void;
}) {
  const scene = useSceneStore((s) => s.scene);
  const selection = useSceneStore((s) => s.selection);
  const activePartId = useSceneStore((s) => s.activePartId);
  const selected = useSelectedObject();
  const [tab, setTab] = useState<MobileTab>('proprietes');
  const { canUndo, undo } = useHistory();
  const activePart = scene.parts.find((p) => p.id === activePartId) ?? scene.parts[0];
  const b = view.bounds;

  return (
    <div className="m-editor">
      <header className="mobile-header">
        <Link to="/modeles" className="icon-btn icon-btn--plain" aria-label="Retour aux modèles">
          <Icon name="back" size={22} />
        </Link>
        <span className="m-editor__title">
          <span className="mobile-header__title">{scene.name}</span>
          <span className="m-editor__sub">
            {scene.parts.length} pièce{scene.parts.length > 1 ? 's' : ''}
            {b ? ` · ${mm(b.max[2] - b.min[2], 0)}` : ''}
          </span>
        </span>
        <span className="stage__spacer" />
        <StatusPill level={view.status} compact />
      </header>

      <div className="m-editor__viewer">
        {viewer}
        <div role="group" aria-label="Vues" className="segmented m-editor__views">
          {(
            [
              ['iso', '3/4'],
              ['face', 'Face'],
              ['plateau', 'Plateau'],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={viewChoice === v} onClick={() => setViewChoice(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <section className="m-sheet" aria-label="Réglages">
        <span className="m-sheet__grip" aria-hidden="true" />
        <div role="tablist" aria-label="Panneaux" className="segmented segmented--grid segmented--inset m-sheet__tabs">
          {(
            [
              ['elements', 'Éléments'],
              ['proprietes', 'Propriétés'],
              ['impression', 'Impression'],
            ] as const
          ).map(([t, label]) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} aria-controls={`tab-${t}`} id={`tabbtn-${t}`} onClick={() => setTab(t)}>
              {label}
            </button>
          ))}
        </div>
        <div className="m-sheet__body" role="tabpanel" id={`tab-${tab}`} aria-labelledby={`tabbtn-${tab}`}>
          {tab === 'elements' && (
            <>
              <PartTree
                scene={scene}
                evaluations={view.evaluations}
                selection={selection}
                activePartId={activePartId}
                onSelect={(id) => {
                  useSceneStore.getState().select([id]);
                  setTab('proprietes');
                }}
                onActivatePart={(id) => useSceneStore.getState().setActivePart(id)}
              />
              <AddButtons />
            </>
          )}
          {tab === 'proprietes' && (selected ? <ObjectProperties object={selected} eyebrow="Propriétés" /> : activePart && <PartProperties part={activePart} view={view} />)}
          {tab === 'impression' && (
            <>
              {activePart && (
                <ColorBar
                  compact
                  scene={scene}
                  part={activePart}
                  height={heightOf(view.evaluations[activePart.id]?.printBounds)}
                  onChange={(p) => useSceneStore.getState().updatePart(p.id, () => p)}
                />
              )}
              <ChecksPanel parts={scene.parts.filter((p) => p.objects.length)} reports={view.reports} checking={view.checking} onFix={onFix} />
              <ExportProjectButton />
            </>
          )}
        </div>
      </section>

      <div className="m-actionbar">
        <button type="button" className="icon-btn m-actionbar__undo" aria-label="Annuler la dernière modification" disabled={!canUndo} onClick={undo}>
          <Icon name="undo" size={20} />
        </button>
        <ExportButton label={scene.parts.filter((p) => p.objects.length).length > 1 ? 'Exporter les STL' : 'Exporter le STL'} size="lg" className="m-actionbar__export" />
      </div>
    </div>
  );
}

function ExportProjectButton() {
  const { busy, exportProject } = useExport();
  return (
    <button type="button" className="btn btn--block" onClick={exportProject} disabled={busy}>
      <Icon name="zip" />
      Télécharger le projet (.zip)
    </button>
  );
}
