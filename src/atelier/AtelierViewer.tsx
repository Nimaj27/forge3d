/**
 * Scène 3D de l'atelier : chaque forme est affichée séparément (trous translucides),
 * sélection au clic / au toucher, gizmo de déplacement, rotation et redimensionnement.
 */
import { TransformControls } from '@react-three/drei';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BufferAttribute, BufferGeometry, MathUtils, type Group } from 'three';
import type { Scene, SceneObject, Transform, Vec3 } from '../../shared/scene';
import type { MeshData } from '../geometry/types';
import { EULER_ORDER, matrixToTransform } from '../viewer/math';
import { Viewer3D, type ViewerItem } from '../viewer/Viewer3D';
import type { ObjectMesh } from './useObjectMeshes';

export type GizmoTool = 'translate' | 'rotate' | 'scale';

export interface DragInfo {
  id: string;
  transform: Transform;
  scale: Vec3;
}

interface AtelierViewerProps {
  scene: Scene;
  bed: Vec3;
  meshes: Record<string, ObjectMesh>;
  selection: string[];
  tool: GizmoTool;
  snap: boolean;
  showResult: boolean;
  resultItems: ViewerItem[];
  frameKey: string | number;
  onSelect: (id: string, additive: boolean) => void;
  onClear: () => void;
  onCommitTransform: (id: string, t: Transform) => void;
  onCommitScale: (id: string, scale: Vec3) => void;
  onDrag?: (info: DragInfo | null) => void;
}

const SOLID = '#8E9298';
const ACCENT = '#F59E3D';

export function AtelierViewer(props: AtelierViewerProps) {
  const { scene, bed, meshes, showResult, resultItems, frameKey } = props;
  const extraBounds = useMemo(() => {
    let min: Vec3 | null = null;
    let max: Vec3 | null = null;
    for (const part of scene.parts)
      for (const o of part.objects) {
        const b = meshes[o.id]?.bounds;
        if (!b) continue;
        // approximation : boîte locale translatée (suffisant pour cadrer la caméra)
        const p = o.transform.position;
        const lo: Vec3 = [b.min[0] + p[0], b.min[1] + p[1], b.min[2] + p[2]];
        const hi: Vec3 = [b.max[0] + p[0], b.max[1] + p[1], b.max[2] + p[2]];
        min = min ? (min.map((v, i) => Math.min(v, lo[i])) as Vec3) : lo;
        max = max ? (max.map((v, i) => Math.max(v, hi[i])) as Vec3) : hi;
      }
    return min && max ? { min, max } : null;
  }, [scene.parts, meshes]);

  return (
    <Viewer3D
      items={showResult ? resultItems : []}
      layout="assembly"
      bed={bed}
      view="iso"
      frameKey={frameKey}
      extraBounds={extraBounds}
      onBackgroundClick={() => {
        if (Date.now() - lastDragEnd.at > 250) props.onClear();
      }}
      label="Scène 3D de l’atelier"
    >
      <ObjectsLayer {...props} />
    </Viewer3D>
  );
}

/** Horodatage de fin de glissement (pour ignorer le clic qui suit). */
const lastDragEnd = { at: 0 };

function ObjectsLayer(props: AtelierViewerProps) {
  const { scene, meshes, selection, tool, snap, showResult, onSelect, onCommitTransform, onCommitScale, onDrag } = props;
  const refs = useRef(new Map<string, Group>());
  const [target, setTarget] = useState<Group | null>(null);
  const selectedId = selection.length === 1 ? selection[0] : null;
  const selectedObj = useMemo(() => {
    for (const p of scene.parts) {
      const o = p.objects.find((x) => x.id === selectedId);
      if (o) return o;
    }
    return null;
  }, [scene.parts, selectedId]);
  const invalidate = useThree((s) => s.invalidate);

  // Rattache le gizmo à l'objet sélectionné (de premier niveau, non verrouillé)
  useEffect(() => {
    const g = selectedObj && !selectedObj.locked ? (refs.current.get(selectedObj.id) ?? null) : null;
    setTarget(g);
    invalidate();
  }, [selectedObj, meshes, invalidate]);

  const objects = scene.parts.flatMap((p) => p.objects);

  return (
    <>
      {objects.map((o) => (
        <ObjectNode
          key={o.id}
          obj={o}
          mesh={meshes[o.id]?.mesh ?? null}
          meshKey={meshes[o.id]?.key ?? ''}
          selected={selection.includes(o.id)}
          ghost={showResult}
          register={(g) => {
            if (g) refs.current.set(o.id, g);
            else refs.current.delete(o.id);
          }}
          onSelect={onSelect}
        />
      ))}
      {target && selectedObj && !showResult && (
        <TransformControls
          object={target}
          mode={tool}
          size={0.9}
          translationSnap={snap ? 1 : null}
          rotationSnap={snap ? MathUtils.degToRad(15) : null}
          scaleSnap={snap ? 0.05 : null}
          onObjectChange={() => {
            if (!onDrag) return;
            target.updateMatrix();
            onDrag({
              id: selectedObj.id,
              transform: matrixToTransform(target.matrix, false),
              scale: [target.scale.x, target.scale.y, target.scale.z],
            });
          }}
          onMouseUp={() => {
            lastDragEnd.at = Date.now();
            onDrag?.(null);
            target.updateMatrix();
            if (tool === 'scale') {
              const s: Vec3 = [target.scale.x, target.scale.y, target.scale.z];
              const prev = selectedObj.transform.scale ?? [1, 1, 1];
              target.scale.set(prev[0], prev[1], prev[2]);
              if (s.some((v, i) => Math.abs(v - prev[i]) > 1e-4)) onCommitScale(selectedObj.id, [s[0] / prev[0], s[1] / prev[1], s[2] / prev[2]]);
            } else {
              onCommitTransform(selectedObj.id, matrixToTransform(target.matrix, !!selectedObj.transform.scale));
            }
          }}
        />
      )}
    </>
  );
}

function ObjectNode({
  obj,
  mesh,
  meshKey,
  selected,
  ghost,
  register,
  onSelect,
}: {
  obj: SceneObject;
  mesh: MeshData | null;
  meshKey: string;
  selected: boolean;
  ghost: boolean;
  register: (g: Group | null) => void;
  onSelect: (id: string, additive: boolean) => void;
}) {
  const geometry = useMemo(() => {
    if (!mesh) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
    g.setIndex(new BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshKey, mesh !== null]);
  useEffect(() => () => geometry?.dispose(), [geometry]);

  const t = obj.transform;
  const rotation = useMemo(
    () => [MathUtils.degToRad(t.rotation[0]), MathUtils.degToRad(t.rotation[1]), MathUtils.degToRad(t.rotation[2]), EULER_ORDER] as const,
    [t.rotation],
  );
  // En mode « résultat », seule la pièce fusionnée est affichée (pas de formes superposées).
  if (obj.hidden || !geometry || ghost) return <group ref={register} position={t.position} rotation={rotation} scale={t.scale ?? [1, 1, 1]} />;

  const hole = obj.mode === 'hole';
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (Date.now() - lastDragEnd.at < 250) return;
    onSelect(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
  };

  return (
    <group ref={register} position={t.position} rotation={rotation} scale={t.scale ?? [1, 1, 1]}>
      <mesh geometry={geometry} onClick={handleClick} renderOrder={hole ? 2 : 0}>
        {hole ? (
          <meshStandardMaterial
            color={selected ? ACCENT : '#EDEEF0'}
            transparent
            opacity={ghost ? 0.12 : selected ? 0.45 : 0.3}
            depthWrite={false}
            roughness={0.4}
          />
        ) : (
          <meshStandardMaterial
            color={selected ? ACCENT : SOLID}
            transparent={ghost}
            opacity={ghost ? 0.15 : 1}
            depthWrite={!ghost}
            roughness={0.6}
            metalness={0.05}
          />
        )}
      </mesh>
    </group>
  );
}
