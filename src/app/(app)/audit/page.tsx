import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { ScrollText } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth";
import { describeAction } from "@/components/activity-list";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Table, TableWrap, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ event?: string; q?: string }> }) {
  const user = await requirePageUser(["ORGANIZER", "ADMIN"]);
  const sp = await searchParams;
  const events = await db.event.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });
  const allowedIds = events.map((e) => e.id);
  const eventFilter = sp.event && allowedIds.includes(sp.event) ? sp.event : undefined;

  const where: Prisma.AuditLogWhereInput = {
    ...(user.role === "ADMIN"
      ? eventFilter
        ? { eventId: eventFilter }
        : {}
      : { eventId: eventFilter ?? { in: allowedIds } }),
    ...(sp.q ? { action: { contains: sp.q.toLowerCase() } } : {}),
  };
  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 150,
    include: { actor: { select: { name: true, email: true } }, event: { select: { name: true } } },
  });

  return (
    <>
      <PageHeader
        title="Audit log"
        description={user.role === "ADMIN" ? "Every important action across the platform." : "Activity on the events you organise."}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="event"
          defaultValue={eventFilter ?? ""}
          className="h-10 rounded-xl border border-line bg-white px-3 text-sm text-ink-800"
        >
          <option value="">All events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Filter by action (e.g. results, fairjudge)"
          className="h-10 min-w-64 flex-1 rounded-xl border border-line bg-white px-3 text-sm"
        />
        <button className="h-10 rounded-xl bg-ink-900 px-4 text-sm font-semibold text-white hover:bg-ink-800">Filter</button>
      </form>
      <Card>
        {logs.length === 0 ? (
          <EmptyState icon={<ScrollText />} title="No matching activity" />
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Actor</TH>
                  <TH>Action</TH>
                  <TH>Event</TH>
                  <TH>Details</TH>
                </tr>
              </THead>
              <TBody>
                {logs.map((l) => (
                  <TR key={l.id}>
                    <TD className="whitespace-nowrap text-xs">{formatDateTime(l.createdAt)}</TD>
                    <TD>
                      <p className="text-sm font-medium text-ink-900">{l.actor?.name ?? "System"}</p>
                      <p className="text-[11px] text-ink-400">{l.actor?.email}</p>
                    </TD>
                    <TD>
                      <p className="text-sm text-ink-800">{describeAction(l.action)}</p>
                      <p className="font-mono text-[11px] text-ink-400">{l.action}</p>
                    </TD>
                    <TD className="text-xs">{l.event?.name ?? "—"}</TD>
                    <TD className="max-w-xs">
                      <code className="line-clamp-2 break-all font-mono text-[11px] text-ink-500">
                        {JSON.stringify(l.metadata)}
                      </code>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
