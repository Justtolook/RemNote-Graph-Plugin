import type { RNPlugin } from '@remnote/plugin-sdk';
import type { RawRem } from './buildGraph';

/** Built-in powerup codes (BuiltInPowerupCodes in the SDK). Their Rems are RemNote internals. */
const BUILT_IN_POWERUP_CODES = [
  'l', 'a', 'at', 'm', 'c', 'd', 'u', 'dv', 'o', 's', 'e', 'j', 'x', 'r', 'h', 'b', 'i', 'mc',
  'w', 'pn', 'n', 'q', 'qt', 'rt', 'y', 'os', 'k', 'toc', 'tts', 'ew', 'g', 't', 'f', 'p', 'z',
  'cd', 'ty', 'de', 'sp', 'ct', 'hh', 'ha', 'id', 'im', 'sd', 'clo',
];
const DOCUMENT_CODE = 'o';
const DAILY_DOCUMENT_CODE = 'd';

export interface KnowledgeBaseSnapshot {
  rems: RawRem[];
  documentIds: Set<string>;
  powerupIds: Set<string>;
  dailyDocumentIds: Set<string>;
  loadedAt: number;
}

async function taggedIds(plugin: RNPlugin, code: string): Promise<string[]> {
  try {
    const powerup = await plugin.powerup.getPowerupByCode(code);
    const tagged = (await powerup?.taggedRem()) ?? [];
    return tagged.map((r) => r._id);
  } catch {
    return [];
  }
}

/**
 * Reads the whole knowledge base once. Everything after this is synchronous and local,
 * so changing filters or the focused Rem never hits the plugin bridge again.
 */
export async function loadKnowledgeBase(plugin: RNPlugin): Promise<KnowledgeBaseSnapshot> {
  const [all, documentIds, dailyDocumentIds, powerups] = await Promise.all([
    plugin.rem.getAll(),
    taggedIds(plugin, DOCUMENT_CODE),
    taggedIds(plugin, DAILY_DOCUMENT_CODE),
    Promise.all(
      BUILT_IN_POWERUP_CODES.map((code) =>
        plugin.powerup.getPowerupByCode(code).catch(() => undefined)
      )
    ),
  ]);

  const rems: RawRem[] = all.map((rem) => ({
    id: rem._id,
    parent: rem.parent,
    children: rem.children,
    text: rem.text,
    backText: rem.backText,
    type: rem.type as unknown as number,
  }));

  return {
    rems,
    documentIds: new Set(documentIds),
    dailyDocumentIds: new Set(dailyDocumentIds),
    powerupIds: new Set(powerups.flatMap((p) => (p ? [p._id] : []))),
    loadedAt: Date.now(),
  };
}

export async function openRem(plugin: RNPlugin, remId: string, closePopup: boolean) {
  const rem = await plugin.rem.findOne(remId);
  if (!rem) {
    await plugin.app.toast('This Rem no longer exists. Refresh the graph.');
    return;
  }
  if (closePopup) await plugin.widget.closePopup();
  await plugin.window.openRem(rem);
}
