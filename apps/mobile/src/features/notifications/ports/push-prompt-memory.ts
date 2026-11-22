/**
 * Whether this phone was already offered the notifications after a first "VOU" or a first round
 * (R98, item 9, question 1): the offer happens once, and a "no" is kept.
 */
export interface PushPromptMemory {
  wasOffered(): Promise<boolean>;
  markOffered(): Promise<void>;
}
