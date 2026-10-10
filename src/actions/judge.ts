"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { type ActionState, toActionState } from "@/lib/errors";
import { saveEvaluation } from "@/services/judging";

export async function saveEvaluationAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const user = await requireUser(["JUDGE"]);
    const assignmentId = String(fd.get("assignmentId") ?? "");
    const { submitted, total } = await saveEvaluation(user, assignmentId, fd);
    revalidatePath("/judge", "layout");
    return {
      ok: true,
      message: submitted
        ? `Evaluation submitted${total !== null ? ` — weighted score ${total}/100` : ""}. It is now locked.`
        : "Draft saved. Only you can see it.",
    };
  } catch (err) {
    return toActionState(err);
  }
}
