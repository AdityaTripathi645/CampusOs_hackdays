"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import type { ActionState } from "@/lib/errors";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** Compact one-click action for table rows; errors show as a small inline note. */
export function InlineAction({
  action,
  hidden,
  children,
  variant = "secondary",
  size = "sm",
  title,
}: {
  action: ServerAction;
  hidden: Record<string, string>;
  children: React.ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  title?: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false } as ActionState);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        title={title}
        disabled={pending}
        onClick={() => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
          start(() => formAction(fd));
        }}
      >
        {pending && <Loader2 className="animate-spin" />}
        {children}
      </Button>
      {state.error && <span className="max-w-56 text-[11px] leading-tight text-rose-600">{state.error}</span>}
    </span>
  );
}
