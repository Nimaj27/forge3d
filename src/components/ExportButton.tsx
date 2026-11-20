/** Bouton et action d'export des STL (avertissement si le maillage n'est pas imprimable). */
import { useState } from 'react';
import { exportProjectZip, exportStl, stlFileName } from '../lib/exporter';
import { useIsDesktop } from '../lib/useMediaQuery';
import { useSceneStore } from '../store/sceneStore';
import { Icon } from './Icon';
import { toast } from './Toast';

export function useExport() {
  const [busy, setBusy] = useState(false);
  const isDesktop = useIsDesktop();

  const run = async (kind: 'stl' | 'project') => {
    if (busy) return;
    const scene = useSceneStore.getState().scene;
    setBusy(true);
    try {
      const res = kind === 'stl' ? await exportStl(scene, { zip: !isDesktop }) : await exportProjectZip(scene);
      if (res.warnings.length) {
        toast(`Exporté, mais le maillage n’est pas parfait : ${res.warnings.join(' ')}`, 'warning', 8000);
      } else {
        const names = res.files.map((f) => f.fileName).join(' + ');
        toast(kind === 'stl' ? `Exporté : ${names} (maillage vérifié)` : 'Projet téléchargé (.zip)', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export impossible', 'error', 7000);
    } finally {
      setBusy(false);
    }
  };
  return { busy, exportStl: () => run('stl'), exportProject: () => run('project') };
}

/** Libellé « Exporter bouclier.stl + socle.stl » selon les pièces. */
export function useExportLabel(): string {
  const scene = useSceneStore((s) => s.scene);
  const parts = scene.parts.filter((p) => p.objects.length);
  if (parts.length === 0) return 'Exporter le STL';
  if (parts.length > 3) return `Exporter ${parts.length} STL`;
  return `Exporter ${parts.map((p) => stlFileName(scene, p)).join(' + ')}`;
}

export function ExportButton({ label, size = 'md', className = '' }: { label?: string; size?: 'md' | 'lg'; className?: string }) {
  const { busy, exportStl } = useExport();
  const parts = useSceneStore((s) => s.scene.parts.filter((p) => p.objects.length).length);
  const text = label ?? (parts > 1 ? 'Exporter les STL' : 'Exporter le STL');
  return (
    <button type="button" className={`btn btn--primary ${size === 'lg' ? 'btn--lg' : ''} ${className}`} onClick={exportStl} disabled={busy || parts === 0} aria-busy={busy}>
      {busy ? <span className="spinner" aria-hidden="true" /> : <Icon name="download" />}
      {busy ? 'Export…' : text}
    </button>
  );
}
