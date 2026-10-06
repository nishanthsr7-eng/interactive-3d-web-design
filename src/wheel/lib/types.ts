/** Shared shape for anything shown in the wheel or the stack. */
export interface PhotoItem {
  /** Stable key; falls back to the array index. @default undefined */
  id?: string | number;
  /** Photo URL. */
  image: string;
  /** Alt text for the photo. @default "" */
  alt?: string;
  /** Caption shown for the focused/top card. @default undefined */
  label?: string;
}
