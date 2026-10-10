import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-xl border border-line bg-white px-3.5 text-sm text-ink-900 shadow-[0_1px_1px_rgb(17_26_61/0.03)] placeholder:text-ink-400 transition focus:border-brand-400 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:bg-ink-50 aria-[invalid=true]:border-rose-400 aria-[invalid=true]:ring-rose-100";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(fieldBase, "h-10", className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "min-h-24 py-2.5 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <select ref={ref} className={cn(fieldBase, "h-10 appearance-none pr-9")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" />
    </div>
  ),
);
Select.displayName = "Select";

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn("text-[13px] font-semibold text-ink-800", className)} {...props} />
  ),
);
Label.displayName = "Label";

export function Checkbox({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn("size-4 rounded border-ink-300 accent-brand-600", className)}
      {...props}
    />
  );
}
