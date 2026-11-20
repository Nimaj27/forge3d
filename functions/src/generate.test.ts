import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';
import { buildSceneTool, clampToBed, GenerationError, generateScene, type MessagesClient } from './generate';

const scene = {
  version: 1,
  name: 'Porte-clés PACY',
  printer: { id: 'ff-5m-pro', bed: [220, 220, 220] },
  parts: [
    {
      id: 'p',
      name: 'Porte-clés',
      colorChanges: [3],
      objects: [
        { id: 'disque', kind: 'cylinder', params: { radius: 20, height: 3 } },
        { id: 'texte', kind: 'text', params: { text: 'PACY', capHeight: 8.5, depth: 2 }, transform: { position: [0, 0, 2.5] } },
      ],
    },
  ],
};

function fakeClient(responses: Partial<Anthropic.Beta.BetaMessage>[]): MessagesClient & { calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] } {
  const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  return {
    calls,
    beta: {
      messages: {
        create: async (body) => {
          calls.push(structuredClone(body));
          const r = responses.shift();
          if (!r) throw new Error('plus de réponse');
          return { id: 'm', type: 'message', role: 'assistant', model: 'x', stop_reason: 'tool_use', content: [], ...r } as Anthropic.Beta.BetaMessage;
        },
      },
    },
  };
}

const toolUse = (input: unknown) => ({ type: 'tool_use', id: 'tu_1', name: 'build_scene', input }) as Anthropic.Beta.BetaToolUseBlock;

describe('generateScene (Cloud Function)', () => {
  it('outil build_scene : schéma JSON objet, généré depuis zod', () => {
    const tool = buildSceneTool();
    expect(tool.input_schema.type).toBe('object');
    expect(JSON.stringify(tool.input_schema)).toContain('colorChanges');
  });

  it('renvoie une scène valide et le résumé', async () => {
    const client = fakeClient([{ content: [toolUse({ summary: 'Porte-clés rond de 40 mm.', scene })] }]);
    const out = await generateScene(client, { prompt: 'porte-clés rond 40 mm avec PACY' }, { bed: [220, 220, 220], printerId: 'ff-5m-pro' });
    expect(out.summary).toBe('Porte-clés rond de 40 mm.');
    expect(out.scene.parts[0].objects).toHaveLength(2);
    const body = client.calls[0];
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.tool_choice).toEqual({ type: 'auto' });
    expect(body.fallbacks).toBe('default');
  });

  it('réessaie une fois en renvoyant l’erreur de validation à Claude', async () => {
    const bad = structuredClone(scene) as { parts: { objects: { params: Record<string, unknown> }[] }[] };
    bad.parts[0].objects[0].params.radius = -4;
    const client = fakeClient([{ content: [toolUse({ summary: 'x', scene: bad })] }, { content: [toolUse({ summary: 'Corrigé.', scene })] }]);
    const out = await generateScene(client, { prompt: 'test' }, { bed: [220, 220, 220], printerId: 'x' });
    expect(out.summary).toBe('Corrigé.');
    const second = client.calls[1].messages;
    const last = second[second.length - 1];
    expect(Array.isArray(last.content) && (last.content[0] as { type: string; is_error?: boolean }).is_error).toBe(true);
  });

  it('échoue proprement après deux réponses invalides, ou en cas de refus', async () => {
    const client = fakeClient([{ content: [toolUse({ summary: 'x' })] }, { content: [toolUse({ summary: 'x' })] }]);
    await expect(generateScene(client, { prompt: 'test' }, { bed: [220, 220, 220], printerId: 'x' })).rejects.toBeInstanceOf(GenerationError);
    const refused = fakeClient([{ stop_reason: 'refusal', content: [] }]);
    await expect(generateScene(refused, { prompt: 'test' }, { bed: [220, 220, 220], printerId: 'x' })).rejects.toMatchObject({ code: 'refusal' });
  });

  it('joint l’image et la scène courante pour une modification', async () => {
    const client = fakeClient([{ content: [toolUse({ summary: 'ok', scene })] }]);
    await generateScene(
      client,
      { prompt: 'texte plus grand', imageBase64: 'AAAA', imageMediaType: 'image/jpeg', currentScene: scene, history: [{ role: 'assistant', text: 'avant' }, { role: 'user', text: 'u' }] },
      { bed: [220, 220, 220], printerId: 'x' },
    );
    const msgs = client.calls[0].messages;
    expect(msgs[0].role).toBe('user'); // l'historique commence par l'utilisateur
    const last = msgs[msgs.length - 1].content as { type: string; text?: string }[];
    expect(last[0].type).toBe('image');
    expect(last[1].text).toContain('currentScene');
  });

  it('borne les dimensions au plateau', () => {
    const big = { ...scene, parts: [{ ...scene.parts[0], objects: [{ id: 'b', kind: 'box', mode: 'solid', name: '', transform: { position: [500, 0, 0], rotation: [0, 0, 0] }, params: { size: [400, 10, 300], edgeRadius: 0 } }] }] };
    const out = clampToBed(big as never, [220, 220, 220]);
    const b = out.parts[0].objects[0] as { transform: { position: number[] }; params: { size: number[] } };
    expect(b.transform.position[0]).toBe(220);
    expect(b.params.size).toEqual([220, 10, 220]);
  });
});
