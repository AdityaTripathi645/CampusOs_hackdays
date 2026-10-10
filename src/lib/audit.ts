import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

type AuditInput = {
  actorId?: string | null;
  eventId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/** Append-only activity trail. Never throws into the caller's flow. */
export async function audit(input: AuditInput, tx: Prisma.TransactionClient | typeof db = db) {
  try {
    await tx.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        eventId: input.eventId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
      },
    });
  } catch (err) {
    console.error("[CampusOS] audit log write failed", err);
  }
}
