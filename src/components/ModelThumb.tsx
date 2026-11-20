import type { TemplateId } from '../templates/catalog';

/** Vignettes au trait des modèles (illustrations légères, sans image externe). */
export function ModelThumb({ id }: { id: TemplateId }) {
  const common = {
    width: '100%',
    height: '100%',
    viewBox: '0 0 120 90',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
    'aria-hidden': true,
  };
  switch (id) {
    case 'trophee':
      return (
        <svg {...common}>
          <path d="M40 12c13 4 27 4 40 0v26c0 14-9 24-20 28-11-4-20-14-20-28z" />
          <path d="M47 20h26v16c0 8-6 14-13 17-7-3-13-9-13-17z" stroke="var(--accent)" />
          <path d="M36 44h48l-4 6H40z" stroke="var(--accent)" />
          <path d="M55 66h10v6H55z" />
          <path d="M34 72h52l4 10H30z" fill="var(--accent-soft-bg)" stroke="var(--accent)" />
        </svg>
      );
    case 'plaque':
      return (
        <svg {...common}>
          <rect x="16" y="22" width="88" height="46" rx="6" />
          <rect x="22" y="28" width="76" height="34" rx="3" stroke="var(--accent)" />
          <path d="M36 42h48M44 50h32" stroke="var(--accent)" strokeWidth="3" />
          <circle cx="27" cy="45" r="2.5" />
          <circle cx="93" cy="45" r="2.5" />
        </svg>
      );
    case 'porte-cles':
      return (
        <svg {...common}>
          <circle cx="58" cy="50" r="26" />
          <circle cx="58" cy="50" r="21" stroke="var(--accent)" />
          <path d="M46 52h24" stroke="var(--accent)" strokeWidth="4" />
          <path d="M58 36l2 4 4 .5-3 3 1 4-4-2-4 2 1-4-3-3 4-.5z" stroke="var(--accent)" />
          <circle cx="58" cy="16" r="8" />
          <circle cx="58" cy="16" r="3.5" />
        </svg>
      );
    case 'boite':
      return (
        <svg {...common}>
          <path d="M24 44l36-14 36 14v26L60 84 24 70z" />
          <path d="M24 44l36 14 36-14M60 58v26" />
          <path d="M22 30l38-15 38 15-38 15z" stroke="var(--accent)" />
          <path d="M22 30v6l38 15 38-15v-6" stroke="var(--accent)" />
        </svg>
      );
    case 'support-telephone':
      return (
        <svg {...common}>
          <path d="M20 74h80v8H20z" />
          <path d="M78 74V66h10v8" />
          <path d="M34 74L50 14h10L44 74" stroke="var(--accent)" />
          <circle cx="51" cy="44" r="4" />
        </svg>
      );
    case 'image-relief':
      return (
        <svg {...common}>
          <rect x="18" y="16" width="84" height="60" rx="5" />
          <path d="M26 66l20-22 14 14 10-10 22 18" stroke="var(--accent)" />
          <circle cx="78" cy="32" r="6" stroke="var(--accent)" />
        </svg>
      );
  }
}
