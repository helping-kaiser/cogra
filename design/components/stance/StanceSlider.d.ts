/** One stance dimension as a range input — the non-drag equivalent of the pad. */
export interface StanceSliderProps {
  /** Use DIRECTED_LABEL / INTEREST_LABEL, never the repo's own words. */
  label: string;
  value: number;
  onChange?: (value: number) => void;
  /** The −1 end, named: "Against", "Less". A bare track says nothing. */
  minLabel?: string;
  /** The +1 end, named: "For", "More". */
  maxLabel?: string;
  id?: string;
}

export declare function StanceSlider(props: StanceSliderProps): JSX.Element;
