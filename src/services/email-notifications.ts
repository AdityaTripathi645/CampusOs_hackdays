import "server-only";
import { audit } from "@/lib/audit";
import { activeEmailDriver, sendTemplatedEmail } from "@/lib/email";
import type { EmailContent } from "@/emails";

export type NotificationRecipient = {
  email: string;
  emailNotifications: boolean;
  isDemo: boolean;
  content: EmailContent;
};

function shouldNotify(recipient: NotificationRecipient) {
  return recipient.emailNotifications && (activeEmailDriver() === "console" || !recipient.isDemo);
}

export async function sendUserNotification(
  recipient: Omit<NotificationRecipient, "content">,
  template: string,
  content: EmailContent,
  eventId?: string,
) {
  if (!shouldNotify({ ...recipient, content })) return false;
  await sendTemplatedEmail({ to: recipient.email, template, eventId, ...content });
  return true;
}

export async function sendNotificationBatch(
  recipients: NotificationRecipient[],
  input: { template: string; eventId: string },
): Promise<{ attempted: number; skipped: number; background: boolean }> {
  const eligible = recipients.filter(shouldNotify);
  const skipped = recipients.length - eligible.length;
  const sendAll = async () => {
    for (let index = 0; index < eligible.length; index += 10) {
      const group = eligible.slice(index, index + 10);
      await Promise.all(
        group.map((recipient) =>
          sendTemplatedEmail({
            to: recipient.email,
            template: input.template,
            eventId: input.eventId,
            ...recipient.content,
          }),
        ),
      );
    }
    await audit({
      eventId: input.eventId,
      action: "email.batch_sent",
      entityType: "Email",
      metadata: { attempted: eligible.length, skipped },
    });
  };

  if (eligible.length > 10) {
    void sendAll().catch((error) => console.error("[CampusOS email] Background notification batch failed:", error));
    return { attempted: eligible.length, skipped, background: true };
  }

  await sendAll();
  return { attempted: eligible.length, skipped, background: false };
}
