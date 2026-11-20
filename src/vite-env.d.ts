/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Configuration Firebase pour le développement local (facultatif). */
  readonly VITE_FIREBASE_CONFIG?: string;
  /** Région des Cloud Functions (défaut : europe-west1). */
  readonly VITE_FUNCTIONS_REGION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __APP_VERSION__: string;
