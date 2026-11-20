/** Mes projets : compte Google, projets en ligne, travail sur l'appareil, fichiers .forge3d.json. */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Icon } from '../components/Icon';
import { toast } from '../components/Toast';
import { signInWithGoogle, signOutUser, useAuth } from '../firebase/auth';
import { formatNumber } from '../lib/format';
import {
  captureThumbnail,
  deleteProject,
  exportProjectFile,
  importProjectFile,
  listProjects,
  loadProject,
  readAutosave,
  saveProject,
  useCurrentProject,
  type CloudProject,
} from '../projects/projects';
import { useSceneStore } from '../store/sceneStore';

const dateFmt = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

export function ProjetsPage() {
  const { user, available } = useAuth();
  const scene = useSceneStore((s) => s.scene);
  const currentId = useCurrentProject((s) => s.id);
  const setCurrentId = useCurrentProject((s) => s.setId);
  const [projects, setProjects] = useState<CloudProject[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      setProjects(await listProjects());
    } catch (err) {
      setProjects([]);
      toast(err instanceof Error ? err.message : 'Liste indisponible', 'error');
    }
  }, []);

  useEffect(() => {
    if (user) void refresh();
    else setProjects(null);
  }, [user, refresh]);

  useEffect(() => {
    void readAutosave().then((a) => setSavedAt(a?.savedAt ?? null));
  }, [scene]);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Opération impossible', 'error', 7000);
    } finally {
      setBusy(false);
    }
  };

  const objects = scene.parts.reduce((n, p) => n + p.objects.length, 0);

  return (
    <div className="page mobile-body projects">
      <div className="page__head">
        <h1 className="page__title">Mes projets</h1>
        <AccountBox user={user} available={available} />
      </div>

      <section className="card projects__current" aria-label="Projet en cours">
        <div className="projects__current-info">
          <span className="eyebrow">Projet en cours</span>
          <strong className="panel__heading">{scene.name || 'Sans titre'}</strong>
          <span className="props__hint">
            {scene.parts.length} pièce{scene.parts.length > 1 ? 's' : ''} · {objects} élément(s)
            {savedAt ? ` · enregistré sur cet appareil le ${dateFmt.format(new Date(savedAt))}` : ''}
          </span>
        </div>
        <div className="props__row">
          <button type="button" className="btn btn--primary" onClick={() => navigate('/editeur')}>
            <Icon name="pencil" />
            Ouvrir dans l’éditeur
          </button>
          {user && (
            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const id = await saveProject(scene, captureThumbnail(), currentId);
                  setCurrentId(id);
                  toast(currentId ? 'Projet mis à jour en ligne.' : 'Projet enregistré en ligne.', 'success');
                  await refresh();
                })
              }
            >
              <Icon name="cloud" />
              {currentId ? 'Enregistrer en ligne' : 'Enregistrer en ligne (nouveau)'}
            </button>
          )}
          <button type="button" className="btn" onClick={() => exportProjectFile(scene)}>
            <Icon name="download" />
            Exporter .forge3d.json
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            <Icon name="upload" />
            Importer un fichier
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              void run(async () => {
                const imported = await importProjectFile(file);
                useSceneStore.getState().setScene(imported, { keepHistory: true });
                setCurrentId(null);
                toast(`« ${imported.name} » importé.`, 'success');
                navigate('/editeur');
              });
            }}
          />
        </div>
      </section>

      <section aria-label="Projets enregistrés en ligne" className="projects__list">
        <h2 className="panel__heading">Enregistrés en ligne</h2>
        {!available && <p className="props__hint">La sauvegarde en ligne n’est pas configurée : votre travail reste enregistré sur cet appareil, et vous pouvez exporter des fichiers .forge3d.json.</p>}
        {available && user === null && <p className="props__hint">Connectez-vous avec Google pour retrouver vos projets sur tous vos appareils.</p>}
        {user && projects === null && <span className="spinner" aria-label="Chargement" />}
        {user && projects?.length === 0 && <p className="props__hint">Aucun projet en ligne pour l’instant.</p>}
        {projects && projects.length > 0 && (
          <ul className="gallery__grid" aria-label="Projets">
            {projects.map((p) => (
              <li key={p.id}>
                <article className={`model-card project-card ${p.id === currentId ? 'is-current' : ''}`}>
                  <span className="model-card__thumb">{p.thumbnail ? <img src={p.thumbnail} alt="" /> : <Icon name="cube" size={40} />}</span>
                  <span className="model-card__name">{p.name}</span>
                  <span className="model-card__desc">{p.updatedAt ? dateFmt.format(p.updatedAt) : '—'}</span>
                  <div className="props__row">
                    <button
                      type="button"
                      className="btn btn--sm btn--primary"
                      disabled={busy}
                      onClick={() =>
                        run(async () => {
                          useSceneStore.getState().setScene(await loadProject(p.id), { keepHistory: true });
                          setCurrentId(p.id);
                          navigate('/editeur');
                        })
                      }
                    >
                      Ouvrir
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm"
                      aria-label={`Supprimer ${p.name}`}
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Supprimer définitivement « ${p.name} » ?`)) return;
                        void run(async () => {
                          await deleteProject(p.id);
                          if (p.id === currentId) setCurrentId(null);
                          await refresh();
                        });
                      }}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
        {projects && <p className="props__hint">{formatNumber(projects.length, 0)} projet(s) en ligne.</p>}
      </section>
    </div>
  );
}

function AccountBox({ user, available }: ReturnType<typeof useAuth>) {
  if (!available) return <span className="pill pill--sm">Compte indisponible</span>;
  if (user === undefined) return <span className="spinner" aria-label="Chargement du compte" />;
  if (!user)
    return (
      <button type="button" className="btn btn--primary" onClick={() => signInWithGoogle().catch((err) => toast(err instanceof Error ? err.message : 'Connexion impossible', 'error'))}>
        <Icon name="user" />
        Se connecter avec Google
      </button>
    );
  return (
    <span className="account">
      {user.photoURL ? <img src={user.photoURL} alt="" className="account__avatar" referrerPolicy="no-referrer" /> : <Icon name="user" />}
      <span>{user.displayName ?? user.email}</span>
      <button type="button" className="btn btn--sm btn--ghost" onClick={() => void signOutUser()}>
        <Icon name="logout" size={16} />
        Se déconnecter
      </button>
    </span>
  );
}
