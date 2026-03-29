import { jsx, jsxs } from "react/jsx-runtime";
import { forwardRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
const PasswordInput = forwardRef(
  function PasswordInput2({ className = "", wrapperClassName = "", disabled, ...rest }, ref) {
    const [visible, setVisible] = useState(false);
    const mergedClass = [className, "pr-11"].filter(Boolean).join(" ");
    const wrapClass = ["relative w-full", wrapperClassName].filter(Boolean).join(" ");
    return /* @__PURE__ */ jsxs("div", { className: wrapClass, children: [
      /* @__PURE__ */ jsx(
        "input",
        {
          ref,
          type: visible ? "text" : "password",
          disabled,
          className: mergedClass,
          ...rest
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          disabled,
          onClick: () => setVisible((v) => !v),
          className: "absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 disabled:pointer-events-none disabled:opacity-40",
          "aria-label": visible ? "Hide password" : "Show password",
          "aria-pressed": visible,
          children: visible ? /* @__PURE__ */ jsx(EyeOff, { className: "h-[1.125rem] w-[1.125rem] shrink-0", strokeWidth: 2, "aria-hidden": true }) : /* @__PURE__ */ jsx(Eye, { className: "h-[1.125rem] w-[1.125rem] shrink-0", strokeWidth: 2, "aria-hidden": true })
        }
      )
    ] });
  }
);
export {
  PasswordInput
};
