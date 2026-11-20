import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { ModelesPage } from './pages/ModelesPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { useSettings } from './store/settingsStore';

/** Applique la couleur d'accent choisie à tout le thème. */
function useAccent() {
  const accent = useSettings((s) => s.accent);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);
}

export function App() {
  useAccent();
  return (
    <BrowserRouter>
      <div className="app">
        <AppHeader />
        <main className="app-main" id="contenu">
          <Routes>
            <Route path="/" element={<Navigate to="/modeles" replace />} />
            <Route path="/modeles" element={<ModelesPage />} />
            <Route
              path="/editeur"
              element={
                <PlaceholderPage
                  title="Éditeur"
                  icon="pencil"
                  text="L’éditeur 3D arrive au prochain jalon : aperçu sur le plateau, propriétés, vérifications et export STL."
                />
              }
            />
            <Route
              path="/atelier/*"
              element={
                <PlaceholderPage
                  title="Atelier"
                  icon="compass"
                  text="La modélisation libre (formes, trous, croquis 2D) arrive bientôt."
                />
              }
            />
            <Route
              path="/ia"
              element={
                <PlaceholderPage
                  title="Créer avec l’IA"
                  icon="sparkle"
                  text="Décris ton objet en français : cette fonction arrive bientôt."
                />
              }
            />
            <Route
              path="/projets"
              element={
                <PlaceholderPage
                  title="Mes projets"
                  icon="folder"
                  text="La sauvegarde de tes projets (compte Google et appareil) arrive bientôt."
                />
              }
            />
            <Route path="*" element={<Navigate to="/modeles" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
