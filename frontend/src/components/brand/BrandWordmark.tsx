/**
 * Wordmark aligned with sibling Multisystems products (e.g. ReputationSystems):
 * “Image” in black, “Systems” in brand blue, “BY MULTISYSTEMS” subtitle in gray.
 */
type Variant = "compact" | "sidebar" | "hero";

const titleClasses: Record<Variant, string> = {
  compact: "text-sm font-semibold tracking-tight leading-tight",
  sidebar: "text-[15px] font-semibold tracking-tight leading-tight",
  hero: "text-2xl font-semibold tracking-tight text-black",
};

const subClasses: Record<Variant, string> = {
  compact: "mt-0.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-500",
  sidebar: "mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500",
  hero: "mt-2 text-xs font-medium uppercase tracking-[0.2em] text-neutral-500",
};

type Props = {
  variant: Variant;
  /** Use h1 for page titles; div for duplicate chrome (e.g. mobile bar). */
  titleAs?: "h1" | "div";
  className?: string;
};

const BRAND_BLUE = "#3B82F6";

export function BrandWordmark({ variant, titleAs = "div", className = "" }: Props) {
  const TitleTag = titleAs;

  return (
    <div className={className ? `min-w-0 text-left ${className}` : "min-w-0 text-left"}>
      <TitleTag className={titleClasses[variant]}>
        <span className="text-black">Image</span>
        <span style={{ color: BRAND_BLUE }}>Systems</span>
      </TitleTag>
      <p className={subClasses[variant]}>BY MULTISYSTEMS</p>
    </div>
  );
}
