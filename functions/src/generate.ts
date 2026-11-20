/**
 * Génération de Scène par Claude (Messages API + outil `build_scene`).
 * Logique pure (client injecté) pour être testée sans réseau.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { FONT_IDS, sceneSchema, walkObjects, type Scene, type Vec3 } from '../../shared/scene';

/** Modèle par défaut (modifiable par la variable d'environnement CLAUDE_MODEL). */
export const DEFAULT_MODEL = 'claude-sonnet-5-5';
export const MAX_PROMPT = 2000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const inputSchema = z.object({
  prompt: z.string().trim().min(1).max(MAX_PROMPT),
  imageBase64: z.string().max(Math.ceil((MAX_IMAGE_BYTES * 4) / 3)).optional(),
  imageMediaType: z.enum(['image/jpeg', 'image/png', 'image/webp']).optional(),
  currentScene: z.unknown().optional(),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), text: z.string().max(4000) }))
    .max(20)
    .optional(),
  printer: z.object({ id: z.string().max(64), bed: z.tuple([z.number(), z.number(), z.number()]) }).optional(),
});
export type GenerateInput = z.output<typeof inputSchema>;

export interface GenerateOutput {
  scene: Scene;
  summary: string;
}

const toolInputSchema = z.object({
  summary: z.string().max(600),
  scene: sceneSchema,
});

/** Outil `build_scene` : son schéma d'entrée est généré à partir du schéma zod de la Scène. */
export function buildSceneTool(): Anthropic.Beta.BetaTool {
  const json = z.toJSONSchema(toolInputSchema, { io: 'input', unrepresentable: 'any' }) as Record<string, unknown>;
  delete json.$schema;
  return {
    name: 'build_scene',
    description:
      'Construit la Scène Forge3D (JSON) qui répond à la demande : pièces imprimables composées de formes solides et de trous. ' +
      'Appelle cet outil une seule fois, avec la scène complète et un résumé court en français.',
    input_schema: json as Anthropic.Beta.BetaTool['input_schema'],
  };
}

export function systemPrompt(bed: Vec3): string {
  return [
    'Tu es le moteur de modélisation de Forge3D. Tu transformes la demande en une Scène imprimable en appelant uniquement l’outil `build_scene`.',
    'Règles : millimètres ; pièce posée à plat sur z = 0 ; elle tient dans le plateau fourni ; parois ≥ 1,2 mm ; détails ≥ 0,4 mm ; surplombs ≤ 45° quand c’est possible ; un seul bloc par pièce ; reliefs encastrés de 0,5 mm ; pour du bicolore, renseigner `colorChanges`.',
    'Pour une modification, repars de `currentScene` et ne change que ce qui est demandé (garde les identifiants des objets inchangés).',
    `Plateau de l’imprimante : ${bed.join(' × ')} mm (X × Y × Z).`,
    'Conventions de la Scène :',
    '- Repère : X largeur, Y profondeur, Z hauteur. L’origine d’un objet est le centre de sa base (z = 0 en bas de l’objet). Rotation en degrés, appliquée autour de X, puis Y, puis Z (axes fixes).',
    '- box : size [largeur, profondeur, hauteur], edgeRadius ; cylinder : radius, height ; sphere : radius ; cone : radiusBottom, radiusTop, height ; tube : outerRadius, innerRadius, height.',
    `- text : texte posé à plat (lecture selon +X), extrudé vers +Z ; capHeight = hauteur des majuscules ; depth = relief + 0,5 d’encastrement ; police parmi ${FONT_IDS.join(', ')} ; « \\n » pour plusieurs lignes ; onArc pour un texte courbé.`,
    '- sketch : loops = contours fermés (start + segments line/arc avec bulge/bezier), op extrude (height) ou revolve (profil à droite de l’axe Y, angle).',
    '- loft : sections octogonales {z, width, depth, chamfer} reliées en une seule coque (socles).',
    '- group : children ; mode « hole » = l’objet est soustrait des solides de la pièce.',
    '- Pour un relief sur une pièce d’épaisseur e : position z = e − 0,5 et depth = relief + 0,5. Pour un trou traversant : cylindre « hole » de hauteur e + 2 à z = −1.',
    '- Bicolore : colorChanges = [e] (dessus de la base, multiple de 0,2 mm) ; la pause se fera à la couche suivante.',
    '- Le résumé (`summary`) est en français, en 1 à 3 phrases courtes : dimensions principales, couleurs, pause éventuelle.',
  ].join('\n');
}

/** Borne les dimensions et positions au plateau (sécurité après validation). */
export function clampToBed(scene: Scene, bed: Vec3): Scene {
  const maxXY = Math.max(bed[0], bed[1]);
  const lim = (v: number, max: number) => Math.max(-max, Math.min(max, v));
  const pos = (v: number, max: number) => Math.max(0.1, Math.min(max, v));
  const copy = structuredClone(scene);
  copy.printer = { ...copy.printer, bed };
  for (const part of copy.parts)
    walkObjects(part.objects, (o) => {
      const t = o.transform;
      t.position = [lim(t.position[0], bed[0]), lim(t.position[1], bed[1]), lim(t.position[2], bed[2])];
      const p = o.params as Record<string, unknown>;
      if (o.kind === 'box') {
        const s = p.size as Vec3;
        p.size = [pos(s[0], maxXY), pos(s[1], maxXY), pos(s[2], bed[2])];
      }
      for (const key of ['radius', 'outerRadius', 'innerRadius', 'radiusBottom', 'radiusTop']) {
        if (typeof p[key] === 'number') p[key] = Math.min(p[key] as number, maxXY / 2);
      }
      for (const key of ['height', 'depth']) {
        if (typeof p[key] === 'number') p[key] = Math.min(p[key] as number, bed[2]);
      }
      if (typeof p.width === 'number') p.width = Math.min(p.width as number, maxXY);
      if (typeof p.capHeight === 'number') p.capHeight = Math.min(p.capHeight as number, maxXY / 2);
    });
  return copy;
}

/** Message d'erreur zod lisible (renvoyé à Claude pour la nouvelle tentative). */
function zodMessage(err: z.ZodError): string {
  return err.issues
    .slice(0, 12)
    .map((i) => `- ${i.path.join('.') || '(racine)'} : ${i.message}`)
    .join('\n');
}

export class GenerationError extends Error {
  constructor(
    message: string,
    readonly code: 'refusal' | 'invalid' | 'truncated',
  ) {
    super(message);
  }
}

/** Client minimal attendu (sous-ensemble du SDK Anthropic), pour pouvoir le simuler en test. */
export interface MessagesClient {
  beta: { messages: { create: (body: Anthropic.Beta.MessageCreateParamsNonStreaming) => Promise<Anthropic.Beta.BetaMessage> } };
}

export async function generateScene(client: MessagesClient, input: GenerateInput, opts: { model?: string; bed: Vec3; printerId: string }): Promise<GenerateOutput> {
  const model = opts.model || DEFAULT_MODEL;
  const tool = buildSceneTool();
  const current = input.currentScene ? sceneSchema.safeParse(input.currentScene) : null;

  const userContent: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.imageBase64 && input.imageMediaType) {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: input.imageMediaType, data: input.imageBase64 } });
  }
  let text = input.prompt;
  if (current?.success) text += `\n\ncurrentScene (à modifier) :\n${JSON.stringify(current.data)}`;
  text += `\n\nImprimante : ${opts.printerId}, plateau ${opts.bed.join(' × ')} mm.`;
  userContent.push({ type: 'text', text });

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of input.history ?? []) messages.push({ role: h.role, content: h.text });
  // l'historique doit commencer par un message utilisateur
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: userContent });

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.beta.messages.create({
      model,
      max_tokens: 16000,
      system: systemPrompt(opts.bed),
      tools: [tool],
      // Choix d'outil « auto » : le choix forcé n'est pas accepté par ce modèle ; la consigne impose l'outil.
      tool_choice: { type: 'auto' },
      // Repli côté serveur si le modèle refuse (classificateurs de sécurité).
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages,
    });

    if (response.stop_reason === 'refusal') {
      throw new GenerationError('La demande a été refusée par le modèle. Reformulez votre description.', 'refusal');
    }
    if (response.stop_reason === 'max_tokens') {
      throw new GenerationError('La scène demandée est trop complexe : simplifiez la description.', 'truncated');
    }
    const call = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === 'build_scene');
    // le contenu complet (blocs de réflexion compris) est renvoyé tel quel
    messages.push({ role: 'assistant', content: response.content as Anthropic.Beta.BetaContentBlockParam[] });
    if (!call) {
      messages.push({ role: 'user', content: 'Appelle maintenant l’outil `build_scene` avec la scène complète.' });
      continue;
    }
    const parsed = toolInputSchema.safeParse(call.input);
    if (parsed.success) {
      const scene = clampToBed({ ...parsed.data.scene, template: undefined }, opts.bed);
      return { scene, summary: parsed.data.summary.trim() || 'Voici une proposition.' };
    }
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: `La scène ne respecte pas le schéma. Corrige ces points et rappelle \`build_scene\` :\n${zodMessage(parsed.error)}`,
        },
      ],
    });
  }
  throw new GenerationError('La scène générée n’est pas valide. Réessayez en reformulant.', 'invalid');
}
