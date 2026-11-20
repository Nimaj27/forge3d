import { Link } from 'react-router';
import { Icon, type IconName } from '../components/Icon';

/** Écran temporaire pour une section dont le jalon n'est pas encore livré. */
export function PlaceholderPage({ title, icon, text }: { title: string; icon: IconName; text: string }) {
  return (
    <div className="page mobile-body">
      <div className="placeholder">
        <span className="placeholder__icon">
          <Icon name={icon} size={30} />
        </span>
        <h1 className="page__title">{title}</h1>
        <p>{text}</p>
        <Link className="btn btn--primary" to="/modeles">
          Voir les modèles
        </Link>
      </div>
    </div>
  );
}
