import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useReducer } from "react";

import { errorTextOf } from "../../../services/api/api-error-text";
import type { QrMatrix } from "../../../services/qr/qr-encoder";
import { useServices } from "../../../services/services-context";
import { displayInviteLink, inviteLink, inviteMessage } from "../model/invite-link";
import {
  initialInviteScreenState,
  inviteScreenReducer,
  type InviteScreenState,
} from "../model/invite-screen.reducer";
import {
  openInviteLink,
  regenerateInviteLink,
  sendInviteOnWhatsApp,
} from "../queries/invite-link-flow";
import type { StoredInviteLink } from "../ports/invite-link-store";

/** What the screen draws once the link is ready. Built on each render, never kept (ADR 0049, D7). */
export interface ReadyInvite {
  readonly shown: string;
  readonly matrix: QrMatrix;
}

export type InviteView =
  | { readonly kind: "unavailable" }
  | { readonly kind: "loading" }
  | { readonly kind: "failed"; readonly errorText: string }
  | { readonly kind: "ready"; readonly invite: ReadyInvite };

export interface InviteScreenModel {
  readonly view: InviteView;
  readonly state: InviteScreenState;
  readonly pending: boolean;
  readonly retry: () => void;
  readonly copy: () => void;
  readonly sendOnWhatsApp: () => void;
  readonly askRegenerate: () => void;
  readonly closeRegenerate: () => void;
  readonly regenerate: () => void;
}

type LinkStep =
  | { readonly kind: "open" }
  | { readonly kind: "regenerate"; readonly inviteId: string };

interface ViewInput {
  readonly baseUrl: string | null;
  readonly link: StoredInviteLink | undefined;
  readonly failure: Error | null;
  readonly encode: (text: string) => QrMatrix;
}

/** The view of screen 19d from the base URL and the result of the mutation, pure. */
export function inviteViewOf({ baseUrl, link, failure, encode }: ViewInput): InviteView {
  if (baseUrl === null) return { kind: "unavailable" };
  if (link === undefined) {
    return failure === null
      ? { kind: "loading" }
      : { kind: "failed", errorText: errorTextOf(failure) };
  }
  return {
    kind: "ready",
    invite: {
      shown: displayInviteLink(baseUrl, link.token),
      matrix: encode(inviteLink(baseUrl, link.token)),
    },
  };
}

/**
 * Screen 19d. The token lives in the `InviteLinkStore` and in the result of this one mutation, which
 * the cache drops as soon as the screen leaves (`gcTime: 0`); never in a query, the reducer or a log.
 */
export function useInviteScreen(groupId: string, groupName: string): InviteScreenModel {
  const services = useServices();
  const client = useQueryClient();
  const deps = { api: services.sacouApi, client, store: services.inviteLinkStore };
  const baseUrl = services.inviteBaseUrl;
  const [state, dispatch] = useReducer(inviteScreenReducer, initialInviteScreenState);
  // A failed "gerar outro" shows the error and "Tentar de novo", which reads the link kept again.
  const link = useMutation({
    gcTime: 0,
    mutationFn: (step: LinkStep) =>
      step.kind === "open"
        ? openInviteLink(deps, groupId)
        : regenerateInviteLink(deps, groupId, step.inviteId),
    onSuccess: () => {
      dispatch({ type: "link-changed" });
    },
  });
  const { mutate } = link;
  const enabled = baseUrl !== null;
  useEffect(() => {
    // Opens the link once per visit; the mutation is the only holder of the token in memory.
    if (enabled) mutate({ kind: "open" });
  }, [enabled, mutate]);

  const stored = link.data;
  const full = baseUrl === null || stored === undefined ? null : inviteLink(baseUrl, stored.token);
  return {
    view: inviteViewOf({
      baseUrl,
      link: stored,
      failure: link.error,
      encode: (text) => services.qrEncoder.encode(text),
    }),
    state,
    pending: link.isPending,
    retry: () => {
      mutate({ kind: "open" });
    },
    copy: () => {
      if (full === null) return;
      void services.clipboard.setText(full).then(() => {
        dispatch({ type: "copied" });
      });
    },
    sendOnWhatsApp: () => {
      if (full === null) return;
      void sendInviteOnWhatsApp(
        services.externalLink,
        services.shareSheet,
        inviteMessage(groupName, full),
      );
    },
    askRegenerate: () => {
      dispatch({ type: "regenerate-asked" });
    },
    closeRegenerate: () => {
      dispatch({ type: "regenerate-closed" });
    },
    regenerate: () => {
      dispatch({ type: "regenerate-closed" });
      if (stored !== undefined) mutate({ kind: "regenerate", inviteId: stored.inviteId });
    },
  };
}
