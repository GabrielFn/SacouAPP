/**
 * The touches on a push of the app, and the pushes that arrive with the app in front. The `data` is
 * untrusted until `parseNotificationTap` reads it: anyone who knows the token could send a push.
 */
export interface NotificationTaps {
  /** The touch that opened the app from closed, once: read, it is forgotten. */
  lastTap(): Promise<unknown>;
  onTap(listener: (data: unknown) => void): () => void;
  /** A push arrived with the app open: the system shows the banner, the list is read again. */
  onReceived(listener: () => void): () => void;
}
