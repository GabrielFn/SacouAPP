import { parseGroupSettings, type GroupSettings } from "@sacou/match-engine";

import type { GroupSettingsDocument, SavedTemplate } from "../../../services/api/sacou-api";

/**
 * What the screens read of the settings of a group: the document the engine accepted, and which
 * template it came from. The raw `settings` of the contract (untyped JSON) never leaves `toSettingsView`.
 */
export interface GroupSettingsView {
  readonly settings: GroupSettings;
  readonly templateKey: string | null;
  readonly savedTemplateId: string | null;
}

/** `null` when the document does not pass the same parser the server uses: nothing is kept. */
export function toSettingsView(document: GroupSettingsDocument): GroupSettingsView | null {
  const parsed = parseGroupSettings(document.settings);
  return parsed.ok
    ? {
        settings: parsed.value,
        templateKey: document.templateKey,
        savedTemplateId: document.savedTemplateId,
      }
    : null;
}

export type TemplateLabel =
  | { readonly kind: "ready"; readonly key: string }
  | { readonly kind: "saved"; readonly name: string }
  | { readonly kind: "custom" };

/** The "Modelo usado" of screen 18: a saved template that was deleted reads as "Personalizado". */
export function templateLabel(
  view: GroupSettingsView,
  saved: readonly SavedTemplate[],
): TemplateLabel {
  if (view.templateKey !== null) return { kind: "ready", key: view.templateKey };
  const match = saved.find((template) => template.templateId === view.savedTemplateId);
  return match === undefined ? { kind: "custom" } : { kind: "saved", name: match.name };
}
