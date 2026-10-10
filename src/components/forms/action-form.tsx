"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Label } from "@/components/ui/inputs";
import type { ActionState } from "@/lib/errors";
import { cn } from "@/lib/utils";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

type FormCtx = {
  fieldErrors: Record<string, string[] | undefined>;
  pending: boolean;
  submitter: { name: string; value: string } | null;
};
const FormContext = React.createContext<FormCtx>({ fieldErrors: {}, pending: false, submitter: null });

/**
 * Client wrapper around a server action: pending state, inline success/error
 * banners, and field-level errors propagated to <Field>.
 *
 * Submits via a transition (not `<form action>`) so React does not reset the
 * user's input when the server returns a validation error.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showMessages = true,
  onSuccess,
  ...rest
}: {
  action: ServerAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showMessages?: boolean;
  onSuccess?: (state: ActionState) => void;
} & Omit<React.FormHTMLAttributes<HTMLFormElement>, "action" | "children" | "onSubmit">) {
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const [pending, startTransition] = useTransition();
  const [submitter, setSubmitter] = React.useState<FormCtx["submitter"]>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const lastHandled = React.useRef<ActionState | null>(null);

  React.useEffect(() => {
    if (state === lastHandled.current) return;
    lastHandled.current = state;
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
  }, [state, resetOnSuccess, onSuccess]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const btn = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const fd = new FormData(e.currentTarget);
    if (btn?.name) fd.set(btn.name, btn.value);
    setSubmitter(btn?.name ? { name: btn.name, value: btn.value } : null);
    startTransition(() => formAction(fd));
  };

  return (
    <FormContext.Provider value={{ fieldErrors: state.fieldErrors ?? {}, pending, submitter }}>
      <form ref={formRef} onSubmit={onSubmit} className={className} {...rest}>
        {showMessages && <FormMessage state={state} />}
        {children}
      </form>
    </FormContext.Provider>
  );
}

export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.error)
    return (
      <div
        role="alert"
        className={cn(
          "mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800",
          className,
        )}
      >
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span>{state.error}</span>
      </div>
    );
  if (state.ok && state.message)
    return (
      <div
        role="status"
        className={cn(
          "mb-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800",
          className,
        )}
      >
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
        <span>{state.message}</span>
      </div>
    );
  return null;
}

export function useFieldError(name: string) {
  return React.useContext(FormContext).fieldErrors[name]?.[0];
}

/** Label + control + hint + server-side error, wired by `name`. */
export function Field({
  label,
  name,
  hint,
  required,
  className,
  children,
}: {
  label: React.ReactNode;
  name: string;
  hint?: React.ReactNode;
  required?: boolean;
  className?: string;
  children: React.ReactElement<{ id?: string; name?: string; "aria-invalid"?: boolean }>;
}) {
  const error = useFieldError(name);
  const id = children.props.id ?? `f-${name}`;
  const control = React.cloneElement(children, {
    id,
    name: children.props.name ?? name,
    "aria-invalid": error ? true : undefined,
  });
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {control}
      {error ? (
        <p className="text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const error = useFieldError(name);
  return error ? <p className="mt-1 text-xs font-medium text-rose-600">{error}</p> : null;
}

export function SubmitButton({ children, pendingText, ...props }: ButtonProps & { pendingText?: string }) {
  const { pending, submitter } = React.useContext(FormContext);
  // With several submit buttons, only the one that was clicked shows a spinner.
  const isMine =
    pending && (!props.name || (submitter !== null && submitter.name === props.name && submitter.value === String(props.value ?? "")));
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {isMine && <Loader2 className="animate-spin" />}
      {isMine && pendingText ? pendingText : children}
    </Button>
  );
}
