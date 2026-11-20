/**
 * Registre des modèles paramétriques : chargement dans l'éditeur.
 * Les modèles eux-mêmes sont livrés au jalon J4.
 */
import { toast } from '../components/Toast';
import { TEMPLATE_CATALOG } from './catalog';

export async function loadTemplate(id: string): Promise<boolean> {
  const info = TEMPLATE_CATALOG.find((t) => t.id === id);
  if (!info) {
    toast('Modèle inconnu.', 'error');
    return false;
  }
  toast(`Le modèle « ${info.name} » arrive bientôt.`, 'info');
  return false;
}
