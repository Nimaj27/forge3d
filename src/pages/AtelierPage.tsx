/**
 * Atelier « Formes » : modélisation libre à la manière de Tinkercad.
 * Formes solides ou trous, gizmo, champs numériques, aimantation 1 mm,
 * grouper, dupliquer, aligner, miroir, annuler / rétablir.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { AtelierModeSwitch } from '../components/AtelierModeSwitch';
import type { Scene, Transform, Vec3 } from '../../shared/scene';
import { alignObjects, applyScaleToObject, dropOnBed, freeSpot, groupObjects, mirrorObjects, ungroupObject, type AlignMode } from '../atelier/actions';
import { AtelierViewer, type DragInfo, type GizmoTool } from '../atelier/AtelierViewer';
import { GIZMO_TOOLS as TOOLS, SHAPES } from '../atelier/catalog';
import { useObjectMeshes } from '../atelier/useObjectMeshes';
import { ChecksPanel, StatusPill } from '../components/ChecksPanel';
import { Icon, type IconName } from '../components/Icon';
import { ObjectProperties } from '../components/ObjectProperties';
import { PartTree } from '../components/PartTree';
import { toast } from '../components/Toast';
import { useSceneView } from '../editor/useSceneView';
import { useShortcuts } from '../editor/useShortcuts';
import { degrees, dims } from '../lib/format';
import { useIsDesktop } from '../lib/useMediaQuery';
import { createObject, emptyScene, uniqueName } from '../scene/factory';
import { duplicateObjects, findObject, flattenObjects } from '../scene/ops';
import { useHistory, useSceneStore, useSelectedObject } from '../store/sceneStore';
import { usePrinter } from '../store/settingsStore';
import { UndoRedo } from './EditeurPage';

export function AtelierPage() {
  const isDesktop = useIsDesktop();
  const scene = useSceneStore((s) => s.scene);
  const selection = useSceneStore((s) => s.selection);
  const activePartId = useSceneStore((s) => s.activePartId);
  const sceneVersion = useSceneStore((s) => s.sceneVersion);
  const printer = usePrinter();
  const [tool, setTool] = useState<GizmoTool>('translate');
  const [snap, setSnap] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [drag, setDrag] = useState<DragInfo | null>(null);
  const topObjects = useMemo(() => scene.parts.flatMap((p) => p.objects), [scene.parts]);
  const meshes = useObjectMeshes(topObjects);
  const view = useSceneView(scene, printer.bed);
  const selected = useSelectedObject();
  const actions = useAtelierActions(scene, meshes);

  useShortcuts({ duplicate: actions.duplicate, group: actions.group, ungroup: actions.ungroup, nudge: actions.nudge });

  const onDrag = useThrottledDrag(setDrag);

  const viewer = (
    <AtelierViewer
      scene={scene}
      bed={printer.bed}
      meshes={meshes}
      selection={selection}
      tool={tool}
      snap={snap}
      showResult={showResult}
      resultItems={view.items}
      frameKey={sceneVersion}
      onSelect={(id, additive) => (additive ? useSceneStore.getState().toggleSelect(id) : useSceneStore.getState().select([id]))}
      onClear={() => useSceneStore.getState().select([])}
      onCommitTransform={(id, t: Transform) => useSceneStore.getState().updateObject(id, (o) => ({ ...o, transform: t }))}
      onCommitScale={(id, s: Vec3) => useSceneStore.getState().updateObject(id, (o) => applyScaleToObject(o, s, snap))}
      onDrag={onDrag}
    />
  );

  const badge = selectionBadge(scene, selection, meshes, drag);

  if (!isDesktop) {
    return (
      <MobileAtelier
        viewer={viewer}
        badge={badge}
        tool={tool}
        setTool={setTool}
        actions={actions}
        status={view.status}
      />
    );
  }

  return (
    <div className="workspace">
      <aside className="panel panel--left" aria-label="Formes et objets">
        <span className="eyebrow">Ajouter une forme</span>
        <div className="shape-grid">
          {SHAPES.map((s) => (
            <button key={s.kind} type="button" className="shape-btn" onClick={() => actions.addShape(s.kind, s.width)}>
              <Icon name={s.icon} size={26} strokeWidth={1.6} />
              {s.label}
            </button>
          ))}
        </div>
        <Link to="/atelier/croquis" className="sketch-link">
          <Icon name="sketch" />
          Dessiner un croquis 2D
        </Link>
        <div className="row-between">
          <span className="eyebrow">Objets de la scène</span>
          <button type="button" className="btn btn--sm btn--ghost" onClick={actions.newScene}>
            <Icon name="plus" size={16} />
            Nouvelle scène
          </button>
        </div>
        <PartTree
          scene={scene}
          evaluations={view.evaluations}
          selection={selection}
          activePartId={activePartId}
          onSelect={(id, additive) => (additive ? useSceneStore.getState().toggleSelect(id) : useSceneStore.getState().select([id]))}
          onActivatePart={(id) => useSceneStore.getState().setActivePart(id)}
        />
        <ActionButtons actions={actions} />
      </aside>

      <section className="stage" aria-label="Scène 3D">
        <div className="stage__toolbar">
          <div role="group" aria-label="Manipulation" className="segmented">
            {TOOLS.map((t) => (
              <button key={t.value} type="button" aria-pressed={tool === t.value} onClick={() => setTool(t.value)} title={t.label}>
                <Icon name={t.icon} size={16} />
                {t.label}
              </button>
            ))}
          </div>
          <label className="check toolbar-check">
            <input type="checkbox" checked={snap} onChange={(e) => setSnap(e.target.checked)} />
            Aimanter à la grille · 1 mm
          </label>
          <label className="check toolbar-check">
            <input type="checkbox" checked={showResult} onChange={(e) => setShowResult(e.target.checked)} />
            Voir le résultat
          </label>
          <div className="stage__spacer" />
          <UndoRedo />
        </div>
        <div className="viewer-frame">
          {viewer}
          {badge && <span className="viewer-badge viewer-badge--accent">{badge}</span>}
          <span className="viewer-badge viewer-badge--bl legend-hole">
            <span className="legend-hole__swatch" aria-hidden="true" />
            Trou : retiré à l’export
          </span>
          <span className="viewer-badge viewer-badge--br">
            Plateau {printer.bed[0]} × {printer.bed[1]} mm
          </span>
          {topObjects.length === 0 && (
            <div className="viewer-empty">
              <p>Scène vide : ajoutez une forme à gauche.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="panel panel--right" aria-label="Propriétés de la forme">
        {selected ? (
          <>
            <ObjectProperties object={selected} tiltSlider />
            <div className="card info-card">
              <span className="card__title">Fusion à l’export</span>
              Les solides sont soudés en une seule pièce, les trous sont soustraits. Le maillage est vérifié avant l’export.
            </div>
          </>
        ) : (
          <div className="props">
            <div className="panel__title">
              <span className="eyebrow">Forme sélectionnée</span>
              <span className="panel__heading">Aucune</span>
              <span className="props__kind">
                Cliquez sur une forme pour la modifier. Maj + clic pour en sélectionner plusieurs (grouper, aligner, miroir).
              </span>
            </div>
            <div className="card info-card">
              <span className="card__title">Raccourcis</span>
              <span>Ctrl+Z / Ctrl+Maj+Z : annuler / rétablir</span>
              <span>Ctrl+D : dupliquer · Ctrl+G : grouper</span>
              <span>Flèches : déplacer de 1 mm (Maj : 10 mm, Alt : en hauteur)</span>
              <span>Suppr : supprimer</span>
            </div>
          </div>
        )}
        <ChecksPanel parts={scene.parts.filter((p) => p.objects.length)} reports={view.reports} checking={view.checking} />
        <StatusPill level={view.status} />
      </aside>
    </div>
  );
}

/** Texte du badge : « Dossier · 80 × 6 × 78 mm · −22° ». */
function selectionBadge(scene: Scene, selection: string[], meshes: ReturnType<typeof useObjectMeshes>, drag: DragInfo | null): string | null {
  if (selection.length > 1) return `${selection.length} formes sélectionnées`;
  const id = selection[0];
  if (!id) return null;
  const obj = findObject(scene, id)?.object;
  if (!obj) return null;
  const b = meshes[id]?.bounds;
  const scale = drag?.id === id ? drag.scale : [1, 1, 1];
  const size = b ? [0, 1, 2].map((i) => Math.abs((b.max[i] - b.min[i]) * scale[i])) : null;
  const rot = (drag?.id === id ? drag.transform.rotation : obj.transform.rotation).find((r) => Math.abs(r) > 0.05);
  const parts = [obj.name || 'Forme'];
  if (size) parts.push(dims(size, 1));
  if (rot !== undefined) parts.push(degrees(rot));
  return parts.join(' · ');
}

function useThrottledDrag(set: (d: DragInfo | null) => void) {
  const frame = useRef(0);
  const pending = useRef<DragInfo | null>(null);
  return useCallback(
    (d: DragInfo | null) => {
      pending.current = d;
      if (d === null) {
        cancelAnimationFrame(frame.current);
        set(null);
        return;
      }
      if (!frame.current)
        frame.current = requestAnimationFrame(() => {
          frame.current = 0;
          set(pending.current);
        });
    },
    [set],
  );
}

/** Actions de l'atelier (liées à la scène courante). */
function useAtelierActions(scene: Scene, meshes: ReturnType<typeof useObjectMeshes>) {
  const boundsOf = useCallback((id: string) => meshes[id]?.bounds ?? null, [meshes]);
  const st = useSceneStore.getState;

  return useMemo(() => {
    const selectionTop = () => {
      const { selection, scene: s } = st();
      return selection.filter((id) => s.parts.some((p) => p.objects.some((o) => o.id === id)));
    };
    return {
      newScene() {
        const { scene: s, setScene } = st();
        setScene(emptyScene(s.printer, 'Création libre'), { keepHistory: true });
        toast('Nouvelle scène. Ctrl+Z pour revenir à la précédente.', 'info');
      },
      addShape(kind: (typeof SHAPES)[number]['kind'], width: number) {
        const { scene: s, activePartId, addObject } = st();
        const part = s.parts.find((p) => p.id === activePartId) ?? s.parts[0];
        const names = flattenObjects(part.objects).map((o) => o.object.name);
        const position = freeSpot(part, boundsOf, width);
        const label = SHAPES.find((x) => x.kind === kind)!.label;
        addObject(createObject(kind, { name: uniqueName(label, names), position }), part.id);
      },
      duplicate() {
        const ids = selectionTop();
        if (!ids.length) return;
        const { scene: s } = st();
        const res = duplicateObjects(s, ids, [10, 10, 0]);
        st().update(() => res.scene);
        st().select(res.newIds);
      },
      group() {
        const ids = selectionTop();
        if (ids.length < 2) {
          toast('Sélectionnez au moins deux formes (Maj + clic) pour les grouper.', 'info');
          return;
        }
        const res = groupObjects(st().scene, ids, boundsOf);
        if (!res) {
          toast('Les formes doivent appartenir à la même pièce.', 'warning');
          return;
        }
        st().update(() => res.scene);
        st().select([res.groupId]);
      },
      ungroup() {
        const id = st().selection[0];
        const obj = id ? findObject(st().scene, id)?.object : null;
        if (!obj || obj.kind !== 'group') return;
        const res = ungroupObject(st().scene, id);
        if (!res) return;
        st().update(() => res.scene);
        st().select(res.childIds);
        if (res.droppedHoles) toast('Les trous internes du groupe « trou » ont été retirés.', 'info');
      },
      align(axis: 0 | 1 | 2, mode: AlignMode) {
        const ids = selectionTop();
        if (!ids.length) return;
        st().update((s) => alignObjects(s, ids, axis, mode, boundsOf));
      },
      dropOnBed() {
        const ids = selectionTop();
        if (!ids.length) return;
        st().update((s) => dropOnBed(s, ids, boundsOf));
      },
      mirror(axis: 0 | 1 | 2) {
        const ids = selectionTop();
        if (!ids.length) return;
        st().update((s) => mirrorObjects(s, ids, axis, boundsOf));
      },
      remove() {
        const { selection, removeObjects, scene: s } = st();
        removeObjects(selection.filter((id) => !findObject(s, id)?.object.locked));
      },
      nudge(dx: number, dy: number, dz: number) {
        const ids = selectionTop();
        st().update((s) => ({
          ...s,
          parts: s.parts.map((p) => ({
            ...p,
            objects: p.objects.map((o) =>
              ids.includes(o.id) && !o.locked
                ? { ...o, transform: { ...o.transform, position: [o.transform.position[0] + dx, o.transform.position[1] + dy, o.transform.position[2] + dz] as Vec3 } }
                : o,
            ),
          })),
        }));
      },
    };
    // `scene` change → nouvelles boîtes ; st est stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundsOf, scene]);
}

type AtelierActions = ReturnType<typeof useAtelierActions>;

function ActionButtons({ actions, compact }: { actions: AtelierActions; compact?: boolean }) {
  const selection = useSceneStore((s) => s.selection);
  const selected = useSelectedObject();
  const isGroup = selected?.kind === 'group';
  const none = selection.length === 0;
  return (
    <div className={compact ? 'action-strip' : 'grid-2 action-grid'} role="group" aria-label="Actions sur la sélection" tabIndex={compact ? 0 : undefined}>
      {isGroup ? (
        <button type="button" className="btn" onClick={actions.ungroup}>
          <Icon name="ungroup" size={16} />
          Dégrouper
        </button>
      ) : (
        <button type="button" className="btn" onClick={actions.group} disabled={selection.length < 2}>
          <Icon name="group" size={16} />
          Grouper
        </button>
      )}
      <button type="button" className="btn" onClick={actions.duplicate} disabled={none}>
        <Icon name="copy" size={16} />
        Dupliquer
      </button>
      <MenuButton label="Aligner" icon="align" disabled={none}>
        {(close) => (
          <>
            {selection.length > 1 ? (
              <>
                <MenuItem onClick={() => (actions.align(0, 'min'), close())}>Gauche (X min)</MenuItem>
                <MenuItem onClick={() => (actions.align(0, 'center'), close())}>Centre en X</MenuItem>
                <MenuItem onClick={() => (actions.align(0, 'max'), close())}>Droite (X max)</MenuItem>
                <MenuItem onClick={() => (actions.align(1, 'min'), close())}>Avant (Y min)</MenuItem>
                <MenuItem onClick={() => (actions.align(1, 'center'), close())}>Centre en Y</MenuItem>
                <MenuItem onClick={() => (actions.align(1, 'max'), close())}>Arrière (Y max)</MenuItem>
                <MenuItem onClick={() => (actions.align(2, 'min'), close())}>Bas (Z min)</MenuItem>
                <MenuItem onClick={() => (actions.align(2, 'center'), close())}>Milieu en Z</MenuItem>
                <MenuItem onClick={() => (actions.align(2, 'max'), close())}>Haut (Z max)</MenuItem>
              </>
            ) : (
              <>
                <MenuItem onClick={() => (actions.align(0, 'center'), actions.align(1, 'center'), close())}>Centrer sur le plateau</MenuItem>
              </>
            )}
            <MenuItem onClick={() => (actions.dropOnBed(), close())}>Poser sur le plateau</MenuItem>
          </>
        )}
      </MenuButton>
      <MenuButton label="Miroir" icon="mirror" disabled={none}>
        {(close) => (
          <>
            <MenuItem onClick={() => (actions.mirror(0), close())}>Gauche ↔ droite (X)</MenuItem>
            <MenuItem onClick={() => (actions.mirror(1), close())}>Avant ↔ arrière (Y)</MenuItem>
            <MenuItem onClick={() => (actions.mirror(2), close())}>Haut ↔ bas (Z)</MenuItem>
          </>
        )}
      </MenuButton>
      {compact && (
        <button type="button" className="btn" onClick={actions.remove} disabled={none}>
          <Icon name="trash" size={16} />
          Supprimer
        </button>
      )}
    </div>
  );
}

/** Bouton à menu déroulant accessible (Échap ou clic extérieur pour fermer). */
function MenuButton({ label, icon, disabled, children }: { label: string; icon: IconName; disabled?: boolean; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="btn btn--block" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)}>
        <Icon name={icon} size={16} />
        {label}
      </button>
      {open && (
        <div className="menu__list" role="menu" aria-label={label}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" role="menuitem" className="menu__item" onClick={onClick}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Téléphone
// ---------------------------------------------------------------------------

function MobileAtelier({
  viewer,
  badge,
  tool,
  setTool,
  actions,
  status,
}: {
  viewer: ReactNode;
  badge: string | null;
  tool: GizmoTool;
  setTool: (t: GizmoTool) => void;
  actions: AtelierActions;
  status: ReturnType<typeof useSceneView>['status'];
}) {
  const selected = useSelectedObject();
  const { canUndo, undo } = useHistory();
  const { exportStl, busy } = useExportShort();
  return (
    <div className="m-atelier mobile-body">
      <header className="mobile-header">
        <span className="mobile-header__title">Atelier</span>
        <AtelierModeSwitch compact />
        <span className="stage__spacer" />
        <button type="button" className="icon-btn icon-btn--plain" aria-label="Annuler" disabled={!canUndo} onClick={undo}>
          <Icon name="undo" />
        </button>
        <button type="button" className="icon-btn icon-btn--accent" aria-label="Exporter le STL" disabled={busy} onClick={exportStl}>
          <Icon name="download" />
        </button>
      </header>
      <div className="m-atelier__viewer">
        {viewer}
        {badge && <span className="viewer-badge viewer-badge--accent">{badge}</span>}
        <span className="viewer-badge viewer-badge--bl">Pincer pour zoomer · 2 doigts pour tourner</span>
      </div>
      <div className="shape-strip" role="group" aria-label="Ajouter une forme" tabIndex={0}>
        {SHAPES.map((s) => (
          <button key={s.kind} type="button" className="shape-btn shape-btn--sm" onClick={() => actions.addShape(s.kind, s.width)}>
            <Icon name={s.icon} size={22} strokeWidth={1.6} />
            {s.label}
          </button>
        ))}
      </div>
      <section className="m-atelier__props" aria-label="Propriétés de la forme">
        <div role="group" aria-label="Manipulation" className="segmented segmented--grid">
          {TOOLS.map((t) => (
            <button key={t.value} type="button" aria-pressed={tool === t.value} onClick={() => setTool(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <ActionButtons actions={actions} compact />
        <StatusPill level={status} />
        {selected ? <ObjectProperties object={selected} tiltSlider /> : <p className="props__hint">Touchez une forme pour la sélectionner, ou ajoutez-en une ci-dessus.</p>}
      </section>
    </div>
  );
}

function useExportShort() {
  // export direct depuis l'en-tête mobile
  const [busy, setBusy] = useState(false);
  return {
    busy,
    exportStl: async () => {
      setBusy(true);
      try {
        const { exportStl } = await import('../lib/exporter');
        const res = await exportStl(useSceneStore.getState().scene, { zip: true });
        toast(res.warnings.length ? `Exporté avec avertissement : ${res.warnings.join(' ')}` : 'STL exporté (maillage vérifié)', res.warnings.length ? 'warning' : 'success');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Export impossible', 'error');
      } finally {
        setBusy(false);
      }
    },
  };
}
