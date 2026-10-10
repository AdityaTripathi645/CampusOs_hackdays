"use client";

import * as React from "react";
import type { ActionState } from "@/lib/errors";
import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

type ServerAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * A button that opens a confirmation dialog before running a server action.
 * Hidden inputs carry the action's parameters; `children` adds extra fields.
 */
export function ConfirmAction({
  action,
  hidden,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  triggerLabel,
  triggerVariant = "secondary",
  triggerSize = "sm",
  confirmVariant = "primary",
  icon,
  children,
  disabled,
}: {
  action: ServerAction;
  hidden?: Record<string, string>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  triggerLabel: React.ReactNode;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  confirmVariant?: ButtonProps["variant"];
  icon?: React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  // Remount the form each time the dialog opens so stale errors disappear.
  const [formKey, setFormKey] = React.useState(0);
  const close = React.useCallback(() => setOpen(false), []);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={triggerVariant} size={triggerSize} disabled={disabled}>
          {icon}
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <ActionForm key={formKey} action={action} onSuccess={close}>
          {Object.entries(hidden ?? {}).map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">
                {cancelLabel}
              </Button>
            </DialogClose>
            <SubmitButton variant={confirmVariant}>{confirmLabel}</SubmitButton>
          </DialogFooter>
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
