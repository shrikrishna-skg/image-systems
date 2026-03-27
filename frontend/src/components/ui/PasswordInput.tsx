import { forwardRef, useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";

export type PasswordInputProps = Omit<ComponentProps<"input">, "type"> & {
  /** Classes on the outer wrapper (e.g. `min-w-0 flex-1` in flex rows). */
  wrapperClassName?: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className = "", wrapperClassName = "", disabled, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const mergedClass = [className, "pr-11"].filter(Boolean).join(" ");
    const wrapClass = ["relative w-full", wrapperClassName].filter(Boolean).join(" ");

    return (
      <div className={wrapClass}>
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          disabled={disabled}
          className={mergedClass}
          {...rest}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:pointer-events-none disabled:opacity-40"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
          ) : (
            <Eye className="h-[1.125rem] w-[1.125rem] shrink-0" strokeWidth={2} aria-hidden />
          )}
        </button>
      </div>
    );
  }
);
