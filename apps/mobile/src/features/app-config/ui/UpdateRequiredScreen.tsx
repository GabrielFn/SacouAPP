import { appUpdateStrings as texts } from "../../../strings/app-update.pt-BR";
import { ErrorScreen } from "../../../ui/ErrorScreen";

export interface UpdateRequiredScreenProps {
  /** The store page of this platform; `null` when the API has none yet: the screen then has no button. */
  readonly updateUrl: string | null;
  readonly onUpdate: (url: string) => void;
}

/** "Atualize o Sacou": the whole screen of an app below the minimum build (ADR 0084). */
export function UpdateRequiredScreen({ updateUrl, onUpdate }: UpdateRequiredScreenProps) {
  return (
    <ErrorScreen
      title={texts.title}
      body={updateUrl === null ? texts.bodyWithoutLink : texts.bodyWithLink}
      actions={
        updateUrl === null
          ? []
          : [
              {
                label: texts.update,
                onPress: () => {
                  onUpdate(updateUrl);
                },
              },
            ]
      }
    />
  );
}
