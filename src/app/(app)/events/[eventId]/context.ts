import "server-only";
import { requirePageUser } from "@/lib/auth";
import { loadManagedEvent } from "@/lib/authz";

/** Every event page re-checks role + ownership on the server (layouts alone are not a security boundary). */
export async function eventPageContext(params: Promise<{ eventId: string }>) {
  const user = await requirePageUser(["ORGANIZER", "ADMIN"]);
  const { eventId } = await params;
  const event = await loadManagedEvent(user, eventId);
  return { user, event, eventId };
}
