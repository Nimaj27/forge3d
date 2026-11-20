import { useId, useRef, useState } from 'react';
import type { Vec3 } from '../../shared/scene';
import { CUSTOM_PRINTER_ID, PRINTERS } from '../lib/printers';
import { formatNumber, parseNumber } from '../lib/format';
import { usePrinter, useSettings } from '../store/settingsStore';
import { Icon } from './Icon';

/** Sélecteur d'imprimante (mémorisé). « Personnalisée » ouvre la saisie du volume. */
export function PrinterSelect({ compact = false }: { compact?: boolean }) {
  const printerId = useSettings((s) => s.printerId);
  const customBed = useSettings((s) => s.customBed);
  const setPrinter = useSettings((s) => s.setPrinter);
  const printer = usePrinter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectId = useId();

  const label = (bed: readonly number[]) => bed.map((v) => formatNumber(v, 0)).join(' × ');

  return (
    <>
      <div className="printer-select">
        <Icon name="printer" />
        <label htmlFor={selectId} className="sr-only">
          Imprimante
        </label>
        <select
          id={selectId}
          value={printerId}
          onChange={(e) => {
            setPrinter(e.target.value);
            if (e.target.value === CUSTOM_PRINTER_ID) dialogRef.current?.showModal();
          }}
        >
          {PRINTERS.map((p) => (
            <option key={p.id} value={p.id}>
              {compact ? p.shortName : `${p.name} · ${label(p.bed)}`}
            </option>
          ))}
          <option value={CUSTOM_PRINTER_ID}>
            {compact ? 'Perso' : `Personnalisée · ${label(customBed)}`}
          </option>
        </select>
        {printer.id === CUSTOM_PRINTER_ID && (
          <button
            type="button"
            className="icon-btn icon-btn--plain"
            aria-label="Modifier le volume de l’imprimante personnalisée"
            onClick={() => dialogRef.current?.showModal()}
          >
            <Icon name="settings" />
          </button>
        )}
      </div>
      <CustomBedDialog dialogRef={dialogRef} />
    </>
  );
}

function CustomBedDialog({ dialogRef }: { dialogRef: React.RefObject<HTMLDialogElement | null> }) {
  const customBed = useSettings((s) => s.customBed);
  const setCustomBed = useSettings((s) => s.setCustomBed);
  const [draft, setDraft] = useState<string[]>(() => customBed.map((v) => formatNumber(v, 1)));
  const axes = ['X (largeur)', 'Y (profondeur)', 'Z (hauteur)'];

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      aria-labelledby="custom-bed-title"
      onClose={() => setDraft(customBed.map((v) => formatNumber(v, 1)))}
    >
      <form
        method="dialog"
        className="dialog__body"
        onSubmit={() => {
          const values = draft.map(parseNumber);
          if (values.every((v) => Number.isFinite(v) && v > 0)) setCustomBed(values as Vec3);
        }}
      >
        <h2 id="custom-bed-title" className="panel__heading">
          Imprimante personnalisée
        </h2>
        <p style={{ color: 'var(--text-3)' }}>Volume d’impression en millimètres.</p>
        <div className="grid-3">
          {axes.map((axis, i) => (
            <label key={axis} className="field">
              <span className="field__label">{axis}</span>
              <input
                className="input input--num"
                inputMode="decimal"
                value={draft[i]}
                onChange={(e) => setDraft((d) => d.map((v, j) => (j === i ? e.target.value : v)))}
              />
            </label>
          ))}
        </div>
        <div className="dialog__actions">
          <button type="button" className="btn" onClick={() => dialogRef.current?.close()}>
            Annuler
          </button>
          <button type="submit" className="btn btn--primary">
            Enregistrer
          </button>
        </div>
      </form>
    </dialog>
  );
}
