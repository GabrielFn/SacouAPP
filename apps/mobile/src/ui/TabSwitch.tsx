import { SegmentBar, type SegmentBarOption } from "./SegmentBar";

export type TabOption<T> = SegmentBarOption<T>;

export interface TabSwitchProps<T> {
  readonly options: readonly TabOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
}

/** Tabs drawn as the segmented control (Membros.dc.html .seg), announced as tabs, not as radios. */
export function TabSwitch<T extends string>(props: TabSwitchProps<T>) {
  return <SegmentBar {...props} role="tabs" singleLine />;
}
