/**
 * Aperçu 3D (react-three-fiber) : repère Z vers le haut, plateau de l'imprimante,
 * grille, pièces colorées par couche, surbrillance de la sélection.
 */
import { Grid, OrbitControls } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Matrix4,
  Object3D,
  PerspectiveCamera,
  Sphere,
  TOUCH,
  Vector3,
} from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { Vec3 } from '../../shared/scene';
import type { Bounds, MeshData } from '../geometry/types';
import { createLayerMaterial, setBands } from './layerMaterial';

// Repère de l'impression 3D : Z vers le haut.
Object3D.DEFAULT_UP.set(0, 0, 1);

export type ViewPreset = 'iso' | 'face' | 'top';

export interface ViewerItem {
  id: string;
  hash: string;
  mesh: MeshData;
  /** Coordonnées de modélisation → impression */
  printMatrix: number[];
  bounds: Bounds;
  printBounds: Bounds;
  /** Hauteurs (impression) où commence chaque couleur suivante */
  breaks: number[];
  colors: string[];
}

export interface ViewerOverlay {
  mesh: MeshData;
  /** Matrice monde de l'objet en coordonnées de modélisation */
  matrix: Matrix4;
  /** Pièce de l'objet (pour la disposition « plateau ») */
  partId: string;
}

interface Viewer3DProps {
  items: ViewerItem[];
  layout: 'assembly' | 'print';
  bed: Vec3;
  view: ViewPreset;
  /** Change → recadrage de la caméra */
  frameKey: string | number;
  overlay?: ViewerOverlay | null;
  onBackgroundClick?: () => void;
  /** Contenu additionnel (atelier : objets individuels, gizmo) */
  children?: ReactNode;
  /** Boîte englobante du contenu additionnel (pour le cadrage) */
  extraBounds?: Bounds | null;
  label?: string;
}

const VIEW_DIRS: Record<ViewPreset, Vector3> = {
  iso: new Vector3(0.9, -1.35, 0.95).normalize(),
  face: new Vector3(0, -1, 0.08).normalize(),
  top: new Vector3(0, -0.02, 1).normalize(),
};

const PRINT_GAP = 12;

/** Décalages X pour disposer les pièces côte à côte en orientation d'impression. */
export function printLayoutOffsets(items: readonly ViewerItem[]): number[] {
  const widths = items.map((it) => it.printBounds.max[0] - it.printBounds.min[0]);
  const total = widths.reduce((a, w) => a + w, 0) + PRINT_GAP * Math.max(0, items.length - 1);
  let x = -total / 2;
  return items.map((it, i) => {
    const offset = x - it.printBounds.min[0];
    x += widths[i] + PRINT_GAP;
    return offset;
  });
}

export function Viewer3D(props: Viewer3DProps) {
  const { items, layout, bed, view, frameKey, overlay, onBackgroundClick, children, extraBounds, label } = props;
  const offsets = useMemo(() => (layout === 'print' ? printLayoutOffsets(items) : items.map(() => 0)), [items, layout]);

  const contentBox = useMemo(() => {
    const box = new Box3();
    items.forEach((it, i) => {
      if (layout === 'print') {
        const b = it.printBounds;
        box.expandByPoint(new Vector3(b.min[0] + offsets[i], b.min[1], b.min[2]));
        box.expandByPoint(new Vector3(b.max[0] + offsets[i], b.max[1], b.max[2]));
      } else {
        box.expandByPoint(new Vector3(...it.bounds.min));
        box.expandByPoint(new Vector3(...it.bounds.max));
      }
    });
    if (extraBounds) {
      box.expandByPoint(new Vector3(...extraBounds.min));
      box.expandByPoint(new Vector3(...extraBounds.max));
    }
    if (box.isEmpty()) {
      box.expandByPoint(new Vector3(-bed[0] / 4, -bed[1] / 4, 0));
      box.expandByPoint(new Vector3(bed[0] / 4, bed[1] / 4, bed[2] / 6));
    }
    return box;
  }, [items, layout, offsets, extraBounds, bed]);

  // Recadrage uniquement quand la clé ou la vue change (pas à chaque modification).
  const frameBox = useRef(contentBox);
  const frameToken = `${frameKey}|${view}|${layout}|${items.length > 0}`;
  const lastToken = useRef('');
  if (lastToken.current !== frameToken) {
    lastToken.current = frameToken;
    frameBox.current = contentBox.clone();
  }

  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 35, near: 0.5, far: 5000, position: [200, -300, 220] }}
      onPointerMissed={(e) => {
        if (e.type === 'click') onBackgroundClick?.();
      }}
      aria-label={label ?? 'Aperçu 3D'}
      role="img"
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0E0F12']} />
      <hemisphereLight args={['#f4f5f7', '#2a2c31', 1.15]} />
      <directionalLight position={[-120, -200, 300]} intensity={1.6} />
      <directionalLight position={[220, 160, 120]} intensity={0.55} />
      <Bed bed={bed} />
      {items.map((it, i) => (
        <PartMesh key={it.id} item={it} layout={layout} offsetX={offsets[i]} />
      ))}
      {overlay && <Overlay overlay={overlay} items={items} layout={layout} offsets={offsets} />}
      {children}
      <CameraRig box={frameBox.current} view={view} token={frameToken} />
    </Canvas>
  );
}

function Bed({ bed }: { bed: Vec3 }) {
  const [w, d, h] = bed;
  const outline = useMemo(() => {
    const g = new BufferGeometry();
    const x = w / 2;
    const y = d / 2;
    // contour du plateau + arêtes verticales du volume d'impression
    const pts = [
      [-x, -y, 0, x, -y, 0],
      [x, -y, 0, x, y, 0],
      [x, y, 0, -x, y, 0],
      [-x, y, 0, -x, -y, 0],
      [-x, -y, h, x, -y, h],
      [x, -y, h, x, y, h],
      [x, y, h, -x, y, h],
      [-x, y, h, -x, -y, h],
      [-x, -y, 0, -x, -y, h],
      [x, -y, 0, x, -y, h],
      [x, y, 0, x, y, h],
      [-x, y, 0, -x, y, h],
    ].flat();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pts), 3));
    return g;
  }, [w, d, h]);
  useEffect(() => () => outline.dispose(), [outline]);
  return (
    <group>
      <mesh position={[0, 0, -0.06]}>
        <planeGeometry args={[w, d]} />
        <meshBasicMaterial color="#15171B" side={DoubleSide} />
      </mesh>
      <Grid
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.02]}
        args={[w, d]}
        cellSize={10}
        cellThickness={0.8}
        cellColor="#22252B"
        sectionSize={50}
        sectionThickness={1.1}
        sectionColor="#30343C"
        fadeDistance={4000}
        followCamera={false}
        infiniteGrid={false}
      />
      <lineSegments geometry={outline}>
        <lineBasicMaterial color="#3A3E46" transparent opacity={0.55} />
      </lineSegments>
    </group>
  );
}

function useMeshGeometry(mesh: MeshData | null | undefined, key: string): BufferGeometry | null {
  const geometry = useMemo(() => {
    if (!mesh) return null;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
    g.setIndex(new BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
    // la clé (empreinte) suffit à détecter un nouveau maillage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  return geometry;
}

function PartMesh({ item, layout, offsetX }: { item: ViewerItem; layout: 'assembly' | 'print'; offsetX: number }) {
  const geometry = useMeshGeometry(item.mesh, item.hash);
  const { material, uniforms } = useMemo(() => createLayerMaterial(), []);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => () => material.dispose(), [material]);

  const printMatrix = useMemo(() => new Matrix4().fromArray(item.printMatrix), [item.printMatrix]);
  const objectMatrix = useMemo(() => {
    if (layout === 'assembly') return new Matrix4();
    return new Matrix4().makeTranslation(offsetX, 0, 0).multiply(printMatrix);
  }, [layout, offsetX, printMatrix]);

  useLayoutEffect(() => {
    uniforms.uPrintMatrix.value.copy(printMatrix);
    setBands(uniforms, item.breaks, item.colors);
    invalidate();
  }, [uniforms, printMatrix, item.breaks, item.colors, invalidate]);

  if (!geometry) return null;
  return <mesh geometry={geometry} material={material} matrixAutoUpdate={false} matrix={objectMatrix} />;
}

function Overlay({
  overlay,
  items,
  layout,
  offsets,
}: {
  overlay: ViewerOverlay;
  items: ViewerItem[];
  layout: 'assembly' | 'print';
  offsets: number[];
}) {
  const geometry = useMeshGeometry(overlay.mesh, `${overlay.mesh.positions.length}-${overlay.mesh.indices.length}-${overlay.matrix.elements.join(',')}`);
  const matrix = useMemo(() => {
    if (layout === 'assembly') return overlay.matrix.clone();
    const i = items.findIndex((it) => it.id === overlay.partId);
    if (i < 0) return overlay.matrix.clone();
    return new Matrix4()
      .makeTranslation(offsets[i], 0, 0)
      .multiply(new Matrix4().fromArray(items[i].printMatrix))
      .multiply(overlay.matrix);
  }, [overlay, items, layout, offsets]);
  if (!geometry) return null;
  return (
    <group matrixAutoUpdate={false} matrix={matrix}>
      {/* partie visible : couleur d'accent qui l'emporte sur la surface fusionnée */}
      <mesh geometry={geometry} renderOrder={2}>
        <meshStandardMaterial
          color="#F59E3D"
          emissive="#F59E3D"
          emissiveIntensity={0.25}
          transparent
          opacity={0.85}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-2}
        />
      </mesh>
      {/* partie cachée : silhouette discrète à travers le reste */}
      <mesh geometry={geometry} renderOrder={3}>
        <meshBasicMaterial color="#F59E3D" transparent opacity={0.18} depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function CameraRig({ box, view, token }: { box: Box3; view: ViewPreset; token: string }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const controls = useRef<OrbitControlsImpl>(null);

  useLayoutEffect(() => {
    const sphere = box.getBoundingSphere(new Sphere());
    const radius = Math.max(sphere.radius, 10);
    const vfov = (camera.fov * Math.PI) / 180;
    const aspect = size.width / Math.max(size.height, 1);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    const fov = Math.min(vfov, hfov);
    const dist = (radius / Math.sin(fov / 2)) * 1.45;
    const dir = VIEW_DIRS[view];
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.near = Math.max(0.1, dist / 200);
    camera.far = dist * 30;
    camera.up.set(0, 0, 1);
    camera.lookAt(sphere.center);
    camera.updateProjectionMatrix();
    if (controls.current) {
      controls.current.target.copy(sphere.center);
      controls.current.update();
    }
    invalidate();
    // recadrage uniquement quand le jeton change (ou la taille du canevas au premier rendu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, size.width > 0, size.height > 0]);

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={false}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_ROTATE }}
      maxDistance={3000}
      minDistance={5}
    />
  );
}
