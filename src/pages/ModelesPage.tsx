import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icon, Logo } from '../components/Icon';
import { PrinterSelect } from '../components/PrinterSelect';
import { TEMPLATE_CATALOG, type TemplateInfo } from '../templates/catalog';
import { ModelThumb } from '../components/ModelThumb';

/** Galerie des modèles paramétriques (ordinateur et téléphone). */
export function ModelesPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const list = useMemo(() => {
    const q = normalize(query);
    if (!q) return TEMPLATE_CATALOG;
    return TEMPLATE_CATALOG.filter((t) => normalize(`${t.name} ${t.description} ${t.keywords}`).includes(q));
  }, [query]);

  const open = (t: TemplateInfo) => navigate(`/editeur?modele=${t.id}`);

  return (
    <div className="page mobile-body gallery">
      <header className="gallery__mobile-head only-mobile">
        <Logo size={26} />
        <span className="brand__name">Forge3D</span>
        <span className="stage__spacer" />
        <PrinterSelect compact />
      </header>

      <div className="page__head only-desktop">
        <h1 className="page__title">Modèles</h1>
        <span style={{ color: 'var(--text-3)' }}>Tous réglables, prêts à imprimer</span>
      </div>

      <label className="search">
        <Icon name="search" />
        <span className="sr-only">Rechercher un modèle</span>
        <input type="search" placeholder="Rechercher un modèle" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <Link to="/ia" className="ai-banner">
        <span className="ai-banner__icon">
          <Icon name="sparkle" size={24} />
        </span>
        <span className="ai-banner__text">
          <span className="ai-banner__title">Créer avec l’IA</span>
          <span className="ai-banner__sub">Décris ton objet en français, il est modélisé pour toi.</span>
        </span>
        <Icon name="chevronRight" className="only-desktop" />
      </Link>

      <div className="page__head only-mobile">
        <h1 className="page__title" style={{ fontSize: 20 }}>
          Modèles
        </h1>
        <span style={{ color: 'var(--text-3)', fontSize: 13 }}>tous réglables</span>
      </div>

      {list.length === 0 ? (
        <p style={{ color: 'var(--text-3)' }}>Aucun modèle ne correspond à « {query} ».</p>
      ) : (
        <ul className="gallery__grid" aria-label="Modèles disponibles">
          {list.map((t) => (
            <li key={t.id}>
              <button type="button" className="model-card" onClick={() => open(t)}>
                <span className="model-card__thumb">
                  <ModelThumb id={t.id} />
                </span>
                <span className="model-card__name">{t.name}</span>
                <span className="model-card__desc">{t.description}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <section className="gallery__more only-desktop" aria-label="Autres façons de créer">
        <Link to="/atelier" className="more-card">
          <Icon name="compass" size={22} />
          <span>
            <strong>Atelier</strong>
            <span>Modélisation libre : formes, trous, croquis 2D</span>
          </span>
        </Link>
        <Link to="/projets" className="more-card">
          <Icon name="folder" size={22} />
          <span>
            <strong>Mes projets</strong>
            <span>Reprendre un projet enregistré ou importer un fichier .forge3d.json</span>
          </span>
        </Link>
      </section>
    </div>
  );
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}
