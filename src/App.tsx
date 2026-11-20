import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { ModelesPage } from './pages/ModelesPage';
import { EditeurPage } from './pages/EditeurPage';
import { AtelierPage } from './pages/AtelierPage';
import { CroquisPage } from './pages/CroquisPage';
import { IAPage } from './pages/IAPage';
import { ProjetsPage } from './pages/ProjetsPage';
import { useAutosave } from './projects/projects';
import { ToastZone } from './components/Toast';
import { useSettings } from './store/settingsStore';

/** Applique la couleur d'accent choisie à tout le thème. */
function useAccent() {
  const accent = useSettings((s) => s.accent);
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent);
  }, [accent]);
}

/** Barrière d'erreur : un écran qui plante n'emporte pas toute l'application. */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  override state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page" role="alert">
        <div className="placeholder">
          <h1 className="page__title">Un problème est survenu</h1>
          <p>{this.state.error.message}</p>
          <p>Votre travail est conservé : rechargez la page pour continuer.</p>
          <button type="button" className="btn btn--primary" onClick={() => location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    );
  }
}

export function App() {
  useAccent();
  useAutosave();
  return (
    <BrowserRouter>
      <div className="app">
        <AppHeader />
        <main className="app-main" id="contenu">
          <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Navigate to="/modeles" replace />} />
            <Route path="/modeles" element={<ModelesPage />} />
            <Route path="/editeur" element={<EditeurPage />} />
            <Route path="/atelier" element={<AtelierPage />} />
            <Route path="/atelier/croquis" element={<CroquisPage />} />
            <Route path="/ia" element={<IAPage />} />
            <Route path="/projets" element={<ProjetsPage />} />
            <Route path="*" element={<Navigate to="/modeles" replace />} />
          </Routes>
          </ErrorBoundary>
        </main>
        <BottomNav />
        <ToastZone />
      </div>
    </BrowserRouter>
  );
}
