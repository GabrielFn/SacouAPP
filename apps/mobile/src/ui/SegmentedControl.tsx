import { SegmentBar, type SegmentBarOption } from "./SegmentBar";

export type SegmentOption<T> = SegmentBarOption<T>;

export interface SegmentedControlProps<T> {
  readonly options: readonly SegmentOption<T>[];
  readonly selected: T;
  readonly onSelect: (value: T) => void;
  readonly accessibilityLabel: string;
  readonly disabled?: boolean;
}

/** The segmented control (.sg/.seg): the options share the width, the chosen one is the white pill. */
export function SegmentedControl<T extends string | number | boolean>(
  props: SegmentedControlProps<T>,
) {
  return <SegmentBar {...props} role="radios" />;
}
