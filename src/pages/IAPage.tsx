/**
 * Créer avec l'IA : description en français (+ photo ou croquis), Claude renvoie une Scène,
 * affichée en 3D, itérable en conversation, ajustable dans l'éditeur.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import type { Scene } from '../../shared/scene';
import { useAiStore } from '../ai/aiStore';
import { StatusPill } from '../components/ChecksPanel';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { useSceneView } from '../editor/useSceneView';
import { signInWithGoogle, useAuth } from '../firebase/auth';
import { exportStl } from '../lib/exporter';
import { dims, mm } from '../lib/format';
import { imageFileToBase64Jpeg } from '../lib/imageFile';
import { pauseHeights } from '../lib/layers';
import { useIsDesktop } from '../lib/useMediaQuery';
import { useSceneStore } from '../store/sceneStore';
import { usePrinter, useSettings } from '../store/settingsStore';
import { Viewer3D } from '../viewer/Viewer3D';

const STARTERS = [
  { label: 'Porte-clés avec un prénom', prompt: 'Un porte-clés rond de 40 mm avec « LÉA » en relief, une petite étoile au-dessus et un anneau. Gris et or.' },
  { label: 'Support de téléphone', prompt: 'Un support de téléphone de 80 mm de large, incliné à 68°, avec un passe-câble.' },
  { label: 'Plaque de porte', prompt: 'Une plaque de porte 150 × 60 mm avec « Caserne de Pacy » et deux trous de vis fraisés.' },
  { label: 'Boîte avec couvercle', prompt: 'Une petite boîte 60 × 40 × 30 mm intérieur, parois de 2 mm, avec couvercle emboîtant.' },
];
const FOLLOW_UPS = ['Texte plus grand', 'Ajouter une date', 'Forme de bouclier', 'Plus épais'];

type PendingImage = { data: string; mediaType: 'image/jpeg'; preview: string } | null;

export function IAPage() {
  const isDesktop = useIsDesktop();
  const { user, available } = useAuth();
  const messages = useAiStore((s) => s.messages);
  const pending = useAiStore((s) => s.pending);
  const scene = useAiStore((s) => s.scene);
  const version = useAiStore((s) => s.version);
  const printer = usePrinter();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<PendingImage>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const notConfigured = !available || messages.some((m) => m.error && m.text === 'Mode IA non configuré.');
  const status = notConfigured ? 'off' : user ? 'on' : user === null ? 'signedOut' : 'loading';

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, pending]);

  const submit = async (e?: FormEvent, text = prompt) => {
    e?.preventDefault();
    if (!text.trim() || pending) return;
    setPrompt('');
    const img = image;
    setImage(null);
    const result = await useAiStore.getState().send({ prompt: text, image: img, printer: { id: printer.id, bed: printer.bed } });
    // la scène générée devient la scène ouverte (annulable dans l'éditeur)
    if (result) useSceneStore.getState().setScene(result, { keepHistory: true });
  };

  const attach = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { data, mediaType } = await imageFileToBase64Jpeg(file);
      setImage({ data, mediaType, preview: `data:image/jpeg;base64,${data}` });
    } catch {
      toast('Image illisible.', 'error');
    }
  };

  const doExport = async (s: Scene) => {
    try {
      const res = await exportStl(s, { zip: !isDesktop });
      toast(res.warnings.length ? `Exporté avec avertissement : ${res.warnings.join(' ')}` : 'STL exporté (maillage vérifié).', res.warnings.length ? 'warning' : 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export impossible', 'error');
    }
  };

  const gate =
    status === 'off' ? (
      <div className="notice notice--info" role="status">
        <Icon name="info" />
        <span>
          <strong>Mode IA non configuré.</strong> Le reste de l’application fonctionne normalement : partez d’un modèle ou de l’atelier.
        </span>
      </div>
    ) : status === 'signedOut' ? (
      <div className="notice">
        <Icon name="user" />
        <span style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          Connectez-vous avec Google pour créer avec l’IA (30 créations par jour).
          <button type="button" className="btn btn--primary btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => signInWithGoogle().catch((err) => toast(err instanceof Error ? err.message : 'Connexion impossible', 'error'))}>
            Se connecter avec Google
          </button>
        </span>
      </div>
    ) : null;

  const disabled = status !== 'on' || pending;

  const conversation = (
    <div className="ai-messages" ref={listRef} aria-live="polite">
      {messages.length === 0 && <p className="props__hint">Exemples : dimensions, texte, usage… L’IA construit le modèle 3D, vous l’ajustez ensuite dans l’éditeur.</p>}
      {messages.map((m) =>
        m.role === 'user' ? (
          <div key={m.id} className="ai-msg ai-msg--user">
            {m.image && <img src={m.image} alt="Image jointe" className="ai-msg__img" />}
            {m.text}
          </div>
        ) : (
          <div key={m.id} className={`ai-msg ai-msg--bot ${m.error ? 'ai-msg--error' : ''}`}>
            {!isDesktop && m.scene && (
              <div className="ai-msg__preview">
                <MiniPreview scene={m.scene} />
              </div>
            )}
            <span>{m.text}</span>
            {m.scene && <SceneFacts scene={m.scene} />}
            {m.scene && (
              <div className="props__row">
                <button type="button" className="btn btn--sm" onClick={() => navigate('/editeur')}>
                  Ajuster dans l’éditeur
                </button>
                <button type="button" className="btn btn--sm btn--soft" onClick={() => doExport(m.scene!)}>
                  Exporter le STL
                </button>
              </div>
            )}
          </div>
        ),
      )}
      {pending && (
        <div className="ai-msg ai-msg--bot ai-msg--pending" role="status">
          <span className="spinner" aria-hidden="true" />
          {version ? 'Je modifie le modèle…' : 'Je modélise votre objet…'}
        </div>
      )}
    </div>
  );

  const chips = (
    <div className="ai-chips" role="group" aria-label="Suggestions" tabIndex={0}>
      {(scene ? FOLLOW_UPS.map((label) => ({ label, prompt: label })) : STARTERS).map((c) => (
        <button key={c.label} type="button" className="chip" disabled={disabled} onClick={() => (scene ? submit(undefined, c.prompt) : setPrompt(c.prompt))}>
          {c.label}
        </button>
      ))}
    </div>
  );

  const form = (
    <form className="ai-form" onSubmit={submit}>
      {image && (
        <div className="ai-form__attachment">
          <img src={image.preview} alt="Image jointe" />
          <button type="button" className="icon-btn icon-btn--plain" aria-label="Retirer l’image" onClick={() => setImage(null)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      <label className="sr-only" htmlFor="ai-prompt">
        Description de l’objet
      </label>
      <textarea
        id="ai-prompt"
        rows={isDesktop ? 3 : 2}
        placeholder={isDesktop ? 'Ex. : une plaque 150 × 60 mm avec « Caserne de Pacy » et deux trous de vis…' : 'Décris ton objet…'}
        value={prompt}
        disabled={status !== 'on'}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey && isDesktop) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="ai-form__bar">
        <button type="button" className="btn btn--sm" disabled={disabled} onClick={() => fileRef.current?.click()} aria-label={isDesktop ? undefined : 'Joindre une photo ou un croquis'}>
          <Icon name="camera" size={16} />
          {isDesktop && 'Photo ou croquis'}
        </button>
        <input ref={fileRef} type="file" accept="image/*" capture={isDesktop ? undefined : 'environment'} className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => attach(e.target.files?.[0])} />
        <span className="stage__spacer" />
        <button type="submit" className="icon-btn icon-btn--accent" aria-label="Envoyer" disabled={disabled || !prompt.trim()}>
          <Icon name="send" />
        </button>
      </div>
    </form>
  );

  const pill =
    status === 'on' ? (
      <span className="pill pill--success pill--sm">
        <Icon name="check" size={14} /> {isDesktop ? 'IA connectée' : 'Connectée'}
      </span>
    ) : status === 'off' ? (
      <span className="pill pill--sm">
        <Icon name="info" size={14} /> Non configurée
      </span>
    ) : (
      <span className="pill pill--sm">Non connecté</span>
    );

  if (!isDesktop) {
    return (
      <div className="m-ai mobile-body">
        <header className="mobile-header">
          <h1 className="mobile-header__title">Créer avec l’IA</h1>
          <span className="stage__spacer" />
          {pill}
        </header>
        <div className="m-ai__body">
          {gate}
          {conversation}
          {chips}
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className="workspace workspace--wide-left">
      <section className="panel panel--left ai-panel" aria-label="Conversation avec l’IA">
        <div className="panel__title">
          <div className="row-between">
            <h1 className="page__title" style={{ fontSize: 24 }}>
              Décris ton objet
            </h1>
            {pill}
          </div>
          <p className="props__hint">Dimensions, texte, usage : l’IA construit le modèle 3D, tu l’ajustes ensuite dans l’éditeur.</p>
        </div>
        {gate}
        {conversation}
        {chips}
        {form}
      </section>
      <section className="stage" aria-label="Aperçu du modèle généré">
        <Preview scene={scene} version={version} />
      </section>
    </div>
  );
}

function SceneFacts({ scene }: { scene: Scene }) {
  const parts = scene.parts.length;
  const objects = scene.parts.reduce((n, p) => n + p.objects.length, 0);
  const pauses = scene.parts.flatMap((p) => pauseHeights(p.colorChanges, scene.firstLayerHeight, scene.layerHeight));
  return (
    <span className="props__hint">
      {parts} pièce{parts > 1 ? 's' : ''} · {objects} élément{objects > 1 ? 's' : ''}
      {pauses.length ? ` · pause à ${pauses.map((p) => mm(p, 1)).join(', ')}` : ''}
    </span>
  );
}

function MiniPreview({ scene }: { scene: Scene }) {
  const printer = usePrinter();
  const view = useSceneView(scene, printer.bed);
  return <Viewer3D items={view.items} layout="assembly" bed={printer.bed} view="iso" frameKey={scene.name} label={`Aperçu 3D de ${scene.name}`} />;
}

function Preview({ scene, version }: { scene: Scene | null; version: number }) {
  const printer = usePrinter();
  const empty: Scene = { version: 1, name: '', unit: 'mm', printer: { id: printer.id, bed: printer.bed }, layerHeight: 0.2, firstLayerHeight: 0.2, parts: [{ id: 'vide', name: '', objects: [] }] };
  const view = useSceneView(scene ?? empty, printer.bed);
  const filaments = useSettings((s) => s.filaments);
  const b = view.bounds;
  const pauses = scene ? scene.parts.flatMap((p) => pauseHeights(p.colorChanges, scene.firstLayerHeight, scene.layerHeight)) : [];
  const checks = scene ? Object.values(view.reports).flatMap((r) => r.checks) : [];
  const okText = (id: string, ok: string) => {
    const list = checks.filter((c) => c.id === id);
    if (!list.length) return null;
    const bad = list.find((c) => c.level !== 'ok');
    return { level: bad ? bad.level : 'ok', text: bad ? bad.message : ok };
  };
  const summary = [okText('bed', 'Tient sur le plateau'), okText('manifold', 'Maillage étanche'), okText('overhang', 'Sans support')].filter(Boolean) as { level: string; text: string }[];
  return (
    <>
      <div className="stage__toolbar">
        <span className="panel__heading">{scene?.name || 'Aperçu'}</span>
        {version > 0 && <span className="pill pill--sm">Version {version}</span>}
        <span className="stage__spacer" />
        {b && <span className="props__hint">{dims([b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]])}</span>}
        {scene && <StatusPill level={view.status} />}
      </div>
      <div className="viewer-frame">
        <Viewer3D items={view.items} layout="assembly" bed={printer.bed} view="iso" frameKey={version} label="Aperçu du modèle généré" />
        <span className="viewer-badge viewer-badge--tl">
          Plateau {printer.bed[0]} × {printer.bed[1]} mm
        </span>
        {!scene && (
          <div className="viewer-empty">
            <p>Le modèle généré s’affichera ici.</p>
          </div>
        )}
      </div>
      {scene && (
        <div className="colorbar">
          {summary.map((s) => (
            <span key={s.text} className={`check-line check-line--${s.level}`}>
              <Icon name={s.level === 'ok' ? 'check' : 'warning'} strokeWidth={2.2} />
              {s.text}
            </span>
          ))}
          {pauses.map((p) => (
            <span key={p} className="colorbar__band">
              <span className="swatch" style={{ background: filaments[1] ?? '#D6A838' }} />
              Pause à {mm(p, 1)}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
