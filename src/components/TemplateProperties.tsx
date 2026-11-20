/** Formulaire des réglages d'un modèle paramétrique (éditeur). */
import { useId, useRef } from 'react';
import type { FontId } from '../../shared/scene';
import { formatNumber } from '../lib/format';
import { readImageFile } from '../lib/imageFile';
import { useSceneStore, useSelectedObject } from '../store/sceneStore';
import { getTemplate, normalizeParams, updateTemplateParams } from '../templates/registry';
import type { TemplateField } from '../templates/types';
import { NumberField, SliderField } from './fields';
import { Icon } from './Icon';
import { FontSelect } from './ObjectProperties';
import { toast } from './Toast';

type Params = Record<string, unknown>;

export function TemplateProperties() {
  const template = useSceneStore((s) => s.scene.template);
  const selected = useSelectedObject();
  const def = template ? getTemplate(template.id) : null;
  if (!template || !def) return null;
  const params = normalizeParams(def, template.params);
  const activeSection = selected ? def.sections.find((s) => s.objects?.some((prefix) => selected.id.startsWith(prefix)))?.id : undefined;

  return (
    <div className="props">
      <div className="panel__title">
        <span className="eyebrow">Réglages du modèle</span>
        <span className="panel__heading">{def.name}</span>
        {selected && <span className="props__kind">Élément sélectionné : {selected.name}</span>}
      </div>
      {def.sections.map((section) => {
        const fields = (def.fields as TemplateField<Params>[]).filter((f) => f.section === section.id && (!f.showIf || f.showIf(params)));
        if (!fields.length) return null;
        return (
          <details key={section.id} className="tpl-section" open={!activeSection || activeSection === section.id}>
            <summary>{section.label}</summary>
            <div className="tpl-section__body">
              {fields.map((f) => (
                <TemplateFieldInput key={f.key} field={f} value={params[f.key]} />
              ))}
            </div>
          </details>
        );
      })}
      <button
        type="button"
        className="btn btn--sm btn--ghost"
        title="Garde la scène telle quelle et permet de modifier chaque élément librement (dans l'éditeur et l'atelier)"
        onClick={() => {
          useSceneStore.getState().update((s) => ({ ...s, template: undefined }));
          toast('Modèle détaché : chaque élément se modifie maintenant librement.', 'info');
        }}
      >
        <Icon name="unlock" size={16} />
        Détacher du modèle (édition libre)
      </button>
    </div>
  );
}

function TemplateFieldInput({ field: f, value }: { field: TemplateField<Params>; value: unknown }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (v: unknown) => updateTemplateParams({ [f.key]: v });
  const unit = f.unit ?? '';
  switch (f.type) {
    case 'text':
      return (
        <div className="field">
          <label className="field__label" htmlFor={id}>
            {f.label}
          </label>
          <input id={id} className="input" value={String(value ?? '')} onChange={(e) => set(e.target.value)} />
        </div>
      );
    case 'textarea':
      return (
        <div className="field">
          <label className="field__label" htmlFor={id}>
            {f.label}
          </label>
          <textarea id={id} className="textarea" rows={3} value={String(value ?? '')} onChange={(e) => set(e.target.value)} />
        </div>
      );
    case 'number':
      return <NumberField label={f.label} unit={unit || 'mm'} value={Number(value)} min={f.min} max={f.max} step={f.step ?? 1} onChange={set} />;
    case 'slider':
      return (
        <SliderField
          label={f.label}
          min={f.min ?? 0}
          max={f.max ?? 100}
          step={f.step ?? 1}
          value={Number(value)}
          display={`${formatNumber(Number(value), (f.step ?? 1) < 1 ? 1 : 0, (f.step ?? 1) < 1 ? 1 : 0)}${unit ? (unit === '°' ? '°' : ` ${unit}`) : ''}`}
          onChange={set}
        />
      );
    case 'select':
      return (
        <div className="field">
          <label className="field__label" htmlFor={id}>
            {f.label}
          </label>
          <select id={id} className="select" value={String(value)} onChange={(e) => set(e.target.value)}>
            {f.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'toggle':
      return (
        <label className="check">
          <input type="checkbox" checked={!!value} onChange={(e) => set(e.target.checked)} />
          {f.label}
        </label>
      );
    case 'font':
      return <FontSelect value={value as FontId} onChange={set} />;
    case 'image':
      return (
        <div className="field">
          <span className="field__label">{f.label}</span>
          <div className="props__row">
            <button type="button" className="btn btn--sm" onClick={() => fileRef.current?.click()}>
              <Icon name="image" size={16} />
              {value ? 'Changer d’image' : 'Choisir une image'}
            </button>
            {!!value && f.key !== 'image' && (
              <button type="button" className="btn btn--sm btn--ghost" onClick={() => set('')}>
                Retirer
              </button>
            )}
          </div>
          {typeof value === 'string' && value.startsWith('data:image') && <img className="tpl-thumb" src={value} alt="" />}
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const src = await readImageFile(file);
                const bmp = await createImageBitmap(file);
                const ratio = bmp.height / bmp.width;
                bmp.close();
                updateTemplateParams({ [f.key]: src, ...(f.key === 'image' ? { ratio } : {}) });
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Image illisible', 'error');
              }
            }}
          />
          {f.help && <span className="props__hint">{f.help}</span>}
        </div>
      );
  }
}
