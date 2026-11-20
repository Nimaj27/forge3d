/**
 * Matériau « couleur par couche » : colore chaque fragment selon sa hauteur
 * dans l'orientation d'impression (pauses de couleur, brief §5).
 */
import { Color, Matrix4, MeshStandardMaterial } from 'three';

export const MAX_BANDS = 9;

export interface LayerUniforms {
  uPrintMatrix: { value: Matrix4 };
  uBreaks: { value: Float32Array };
  uColors: { value: Color[] };
  uCount: { value: number };
}

export function createLayerMaterial(): { material: MeshStandardMaterial; uniforms: LayerUniforms } {
  const uniforms: LayerUniforms = {
    uPrintMatrix: { value: new Matrix4() },
    uBreaks: { value: new Float32Array(MAX_BANDS - 1).fill(1e9) },
    uColors: { value: Array.from({ length: MAX_BANDS }, () => new Color('#9A9DA2')) },
    uCount: { value: 0 },
  };
  const material = new MeshStandardMaterial({ roughness: 0.62, metalness: 0.08, color: '#ffffff' });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform mat4 uPrintMatrix;\nvarying float vPrintZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPrintZ = (uPrintMatrix * vec4(transformed, 1.0)).z;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\nuniform float uBreaks[${MAX_BANDS - 1}];\nuniform vec3 uColors[${MAX_BANDS}];\nuniform int uCount;\nvarying float vPrintZ;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  vec3 bandColor = uColors[0];
  for (int i = 0; i < ${MAX_BANDS - 1}; i++) {
    if (i < uCount && vPrintZ >= uBreaks[i] - 0.0005) bandColor = uColors[i + 1];
  }
  diffuseColor.rgb = bandColor;`,
      );
  };
  material.customProgramCacheKey = () => 'forge3d-layer';
  return { material, uniforms };
}

/** Met à jour les tranches : `breaks` = hauteurs où commence la couleur suivante. */
export function setBands(uniforms: LayerUniforms, breaks: readonly number[], colors: readonly string[]): void {
  const n = Math.min(breaks.length, MAX_BANDS - 1);
  uniforms.uCount.value = n;
  for (let i = 0; i < MAX_BANDS - 1; i++) uniforms.uBreaks.value[i] = i < n ? breaks[i] : 1e9;
  for (let i = 0; i < MAX_BANDS; i++) uniforms.uColors.value[i].set(colors[Math.min(i, colors.length - 1)] ?? '#9A9DA2');
}
