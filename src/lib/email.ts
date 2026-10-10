import "server-only";
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import type { EmailContent } from "@/emails";

export interface EmailAdapter {
  readonly driver: string;
  send(message: { to: string; subject: string; html: string; text: string }): Promise<void>;
}

export type EmailStatus = "SENT" | "FAILED";

type EmailMessage = { to: string; subject: string; html: string; text: string };

class ConsoleEmailAdapter implements EmailAdapter {
  readonly driver = "console";

  async send(message: EmailMessage) {
    const outbox = path.resolve(process.cwd(), "./storage/outbox");
    const fileName = `${Date.now()}-${randomUUID()}.html`;
    const filePath = path.join(outbox, fileName);
    await fs.mkdir(outbox, { recursive: true });
    await fs.writeFile(filePath, message.html, "utf8");
    console.info(`[CampusOS email]\nTo: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\nHTML preview: ${filePath}`);
  }
}

class ResendEmailAdapter implements EmailAdapter {
  readonly driver = "resend";

  async send(message: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required when EMAIL_DRIVER is resend.");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), ...message }),
    });
    if (!response.ok) throw new Error(`Resend API returned HTTP ${response.status}.`);
  }
}

class SmtpEmailAdapter implements EmailAdapter {
  readonly driver = "smtp";

  async send(message: EmailMessage) {
    const host = process.env.SMTP_HOST;
    if (!host) throw new Error("SMTP_HOST is required when EMAIL_DRIVER is smtp.");
    const port = Number(process.env.SMTP_PORT ?? "587");
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("SMTP_PORT must be a valid TCP port.");
    if (Boolean(process.env.SMTP_USER) !== Boolean(process.env.SMTP_PASS)) {
      throw new Error("Set both SMTP_USER and SMTP_PASS, or leave both empty.");
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true",
      ...(process.env.SMTP_USER && process.env.SMTP_PASS
        ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
        : {}),
    });
    await transporter.sendMail({ from: fromAddress(), ...message });
  }
}

function fromAddress() {
  return process.env.EMAIL_FROM ?? "CampusOS <no-reply@localhost>";
}

export function activeEmailDriver() {
  return process.env.EMAIL_DRIVER ?? (process.env.NODE_ENV === "development" ? "console" : "not configured");
}

function getEmailAdapter(): EmailAdapter {
  switch (activeEmailDriver()) {
    case "console":
      return new ConsoleEmailAdapter();
    case "resend":
      return new ResendEmailAdapter();
    case "smtp":
      return new SmtpEmailAdapter();
    default:
      throw new Error('Set EMAIL_DRIVER to "console", "resend", or "smtp" before sending email.');
  }
}

export async function sendEmail(input: EmailMessage & { template: string; eventId?: string | null }): Promise<boolean> {
  let status: EmailStatus = "FAILED";
  let errorMessage: string | undefined;

  try {
    const adapter = getEmailAdapter();
    if (adapter.driver !== "console") {
      const recipient = await db.user.findUnique({ where: { email: input.to }, select: { isDemo: true } });
      if (recipient?.isDemo) throw new Error("Email delivery to seeded demo users is disabled for this driver.");
    }
    await adapter.send(input);
    status = "SENT";
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Unknown email delivery error.";
    console.error(`[CampusOS email] Delivery failed for ${input.to}:`, error);
  }

  try {
    await db.emailLog.create({
      data: {
        to: input.to,
        template: input.template,
        subject: input.subject,
        status,
        error: errorMessage,
        eventId: input.eventId,
      },
    });
  } catch (error) {
    console.error("[CampusOS email] Failed to write delivery log:", error);
  }

  return status === "SENT";
}

export function sendTemplatedEmail(
  input: { to: string; template: string; eventId?: string | null } & EmailContent,
): Promise<boolean> {
  return sendEmail(input);
}
