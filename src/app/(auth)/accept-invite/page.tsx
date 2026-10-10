import type { Metadata } from "next";
import Link from "next/link";
import { hashAuthToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const invitation =
    token && token.length <= 2048
      ? await db.invitation.findUnique({
          where: { tokenHash: hashAuthToken(token) },
          include: { event: { select: { name: true } } },
        })
      : null;
  const valid =
    invitation &&
    !invitation.acceptedAt &&
    !invitation.revokedAt &&
    invitation.expiresAt > new Date() &&
    ["ORGANIZER", "JUDGE", "ADMIN"].includes(invitation.role);

  if (!valid || !invitation) {
    return (
      <>
        <h1 className="text-2xl font-bold tracking-tight text-ink-950">Invitation unavailable</h1>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This invitation is invalid, expired, revoked, or has already been used. Ask the inviter to send a new one.
        </p>
        <p className="mt-6 text-center text-sm text-ink-500">
          <Link href="/sign-in" className="font-semibold text-brand-600 hover:underline">Go to sign in</Link>
        </p>
      </>
    );
  }

  const existingUser = await db.user.findUnique({
    where: { email: invitation.email },
    select: { id: true },
  });
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-950">Accept your invitation</h1>
      <p className="mt-1.5 text-sm text-ink-500">
        Join CampusOS as a {invitation.role.toLowerCase()}
        {invitation.event ? ` for ${invitation.event.name}` : ""}.
      </p>
      <AcceptInviteForm token={token!} email={invitation.email} existingUser={Boolean(existingUser)} />
      <p className="mt-6 text-center text-sm text-ink-500">
        Invitation expires {invitation.expiresAt.toLocaleString()}.
      </p>
    </>
  );
}
