export type EmailContent = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

function emailLayout(title: string, content: string) {
  const safeTitle = escapeHtml(title);
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;background:#f4f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #e4e8f0;border-radius:16px;overflow:hidden">
          <tr><td style="padding:24px 32px;background:#182858;color:#ffffff">
            <div style="font-size:20px;font-weight:700">CampusOS</div>
            <div style="margin-top:5px;font-size:13px;color:#dce5ff">One Event. One Intelligence Layer.</div>
          </td></tr>
          <tr><td style="padding:32px">
            <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#172033">${safeTitle}</h1>
            ${content}
          </td></tr>
          <tr><td style="padding:18px 32px;border-top:1px solid #e4e8f0;color:#68738a;font-size:12px">CampusOS · One Event. One Intelligence Layer.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function textValue(value: string) {
  return value.replace(/[\r\n\t]+/g, " ").trim();
}

export function welcomeEmail(input: { name: string }): EmailContent {
  const name = textValue(input.name);
  return {
    subject: "Welcome to CampusOS",
    html: emailLayout(
      "Welcome to CampusOS",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},</p>
       <p style="margin:0;font-size:15px;line-height:1.6">Your CampusOS account is ready. Sign in to discover events and manage your participation.</p>`,
    ),
    text: `Hi ${name},\n\nYour CampusOS account is ready. Sign in to discover events and manage your participation.\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function registrationConfirmationEmail(input: { participantName: string; eventName: string }): EmailContent {
  const participantName = textValue(input.participantName);
  const eventName = textValue(input.eventName);
  return {
    subject: `Registration received: ${eventName}`,
    html: emailLayout(
      "Registration received",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(participantName)},</p>
       <p style="margin:0;font-size:15px;line-height:1.6">Your registration for <strong>${escapeHtml(eventName)}</strong> has been received. You can check its status in your CampusOS account.</p>`,
    ),
    text: `Hi ${participantName},\n\nYour registration for ${eventName} has been received. You can check its status in your CampusOS account.\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function registrationReceivedEmail(input: {
  participantName: string;
  eventName: string;
  waitlisted: boolean;
}): EmailContent {
  const participantName = textValue(input.participantName);
  const eventName = textValue(input.eventName);
  const subject = input.waitlisted ? "Registration received — you're on the waitlist" : "We received your registration";
  const message = input.waitlisted
    ? `Your registration for ${eventName} was received, and you have been added to the waitlist.`
    : `Your registration for ${eventName} was received. The event organizer will review it.`;
  return {
    subject,
    html: emailLayout(
      subject,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(participantName)},</p>
       <p style="margin:0;font-size:15px;line-height:1.6">${escapeHtml(message)}</p>`,
    ),
    text: `Hi ${participantName},\n\n${message}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function registrationStatusEmail(input: {
  participantName: string;
  eventName: string;
  status: "APPROVED" | "REJECTED" | "WAITLISTED";
  eventId: string;
  checkInCode?: string;
}): EmailContent {
  const participantName = textValue(input.participantName);
  const eventName = textValue(input.eventName);
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/explore/${encodeURIComponent(input.eventId)}`;
  const safeUrl = escapeHtml(url);
  const approved = input.status === "APPROVED";
  const waitlisted = input.status === "WAITLISTED";
  const subject = approved
    ? `You're approved: ${eventName}`
    : waitlisted
      ? `You're on the waitlist: ${eventName}`
      : `Registration update: ${eventName}`;
  const message = approved
    ? `Your registration for ${eventName} has been approved.`
    : waitlisted
      ? `Your registration for ${eventName} has been moved to the waitlist.`
      : `Your registration for ${eventName} was not approved.`;
  const checkInCode = textValue(input.checkInCode ?? "");
  return {
    subject,
    html: emailLayout(
      subject,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(participantName)},</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(message)}</p>
       ${
         approved
           ? `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Your check-in code: <strong>${escapeHtml(checkInCode)}</strong></p>`
           : ""
       }
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">View event${approved ? " and QR ID card" : ""}</a></p>`,
    ),
    text: `Hi ${participantName},\n\n${message}${approved ? `\n\nYour check-in code: ${checkInCode}` : ""}\n\nView event${approved ? " and QR ID card" : ""}: ${url}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function teamJoinedEmail(input: { leaderName: string; participantName: string; teamName: string; eventName: string }): EmailContent {
  const leaderName = textValue(input.leaderName);
  const participantName = textValue(input.participantName);
  const teamName = textValue(input.teamName);
  const eventName = textValue(input.eventName);
  return {
    subject: `A participant joined ${teamName}`,
    html: emailLayout(
      "A participant joined your team",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(leaderName)},</p>
       <p style="margin:0;font-size:15px;line-height:1.6">${escapeHtml(participantName)} joined <strong>${escapeHtml(teamName)}</strong> for ${escapeHtml(eventName)}.</p>`,
    ),
    text: `Hi ${leaderName},\n\n${participantName} joined ${teamName} for ${eventName}.\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function submissionConfirmationEmail(input: {
  participantName: string;
  teamName: string;
  eventName: string;
  version: number;
}): EmailContent {
  const participantName = textValue(input.participantName);
  const teamName = textValue(input.teamName);
  const eventName = textValue(input.eventName);
  const version = String(input.version);
  return {
    subject: `Submission received: ${eventName}`,
    html: emailLayout(
      "Submission received",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(participantName)},</p>
       <p style="margin:0;font-size:15px;line-height:1.6">The submission for <strong>${escapeHtml(teamName)}</strong> at ${escapeHtml(eventName)} was received as version ${escapeHtml(version)}.</p>`,
    ),
    text: `Hi ${participantName},\n\nThe submission for ${teamName} at ${eventName} was received as version ${version}.\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function judgeAssignmentsEmail(input: { judgeName: string; eventName: string; newProjects: number }): EmailContent {
  const judgeName = textValue(input.judgeName);
  const eventName = textValue(input.eventName);
  const newProjects = String(input.newProjects);
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/judge`;
  const safeUrl = escapeHtml(url);
  return {
    subject: `Judging assignments updated: ${eventName}`,
    html: emailLayout(
      "Your judging assignments",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(judgeName)},</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6">You have ${escapeHtml(newProjects)} new project assignment(s) for ${escapeHtml(eventName)}.</p>
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">Open your judge workspace</a></p>`,
    ),
    text: `Hi ${judgeName},\n\nYou have ${newProjects} new project assignment(s) for ${eventName}.\n\nOpen your judge workspace: ${url}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function resultsPublishedEmail(input: { participantName: string; eventName: string; eventId: string }): EmailContent {
  const participantName = textValue(input.participantName);
  const eventName = textValue(input.eventName);
  const url = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/explore/${encodeURIComponent(input.eventId)}`;
  const safeUrl = escapeHtml(url);
  return {
    subject: `Results are published: ${eventName}`,
    html: emailLayout(
      "Event results are published",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(participantName)},</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Results for ${escapeHtml(eventName)} are now available.</p>
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">View event</a></p>`,
    ),
    text: `Hi ${participantName},\n\nResults for ${eventName} are now available.\n\nView event: ${url}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function passwordResetEmail(input: { name: string; url: string }): EmailContent {
  const name = textValue(input.name);
  const url = input.url;
  const safeUrl = escapeHtml(url);
  return {
    subject: "Reset your CampusOS password",
    html: emailLayout(
      "Reset your password",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},</p>
       <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Use the link below within 30 minutes to choose a new password. If you did not request this, you can ignore this email.</p>
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">Reset password</a></p>`,
    ),
    text: `Hi ${name},\n\nUse this link within 30 minutes to choose a new password: ${url}\n\nIf you did not request this, you can ignore this email.\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function emailVerificationEmail(input: { name: string; url: string }): EmailContent {
  const name = textValue(input.name);
  const url = input.url;
  const safeUrl = escapeHtml(url);
  return {
    subject: "Verify your CampusOS email",
    html: emailLayout(
      "Verify your email address",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">Hi ${escapeHtml(name)},</p>
       <p style="margin:0 0 20px;font-size:15px;line-height:1.6">Confirm your email address using the link below. This link expires in 24 hours.</p>
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">Verify email address</a></p>`,
    ),
    text: `Hi ${name},\n\nConfirm your email address within 24 hours: ${url}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}

export function invitationEmail(input: { role: string; eventName?: string | null; url: string }): EmailContent {
  const role = textValue(input.role);
  const eventName = input.eventName ? textValue(input.eventName) : null;
  const message = eventName
    ? `You have been invited to join CampusOS as a ${role} for ${eventName}.`
    : `You have been invited to join CampusOS as a ${role}.`;
  const safeUrl = escapeHtml(input.url);
  return {
    subject: "You're invited to CampusOS",
    html: emailLayout(
      "You're invited to CampusOS",
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escapeHtml(message)}</p>
       <p style="margin:0 0 16px;font-size:15px;line-height:1.6">This invitation expires in 7 days.</p>
       <p style="margin:0;font-size:15px;line-height:1.6"><a href="${safeUrl}" style="color:#3156c8">Accept invitation</a></p>`,
    ),
    text: `${message}\n\nThis invitation expires in 7 days.\n\nAccept invitation: ${input.url}\n\nCampusOS · One Event. One Intelligence Layer.`,
  };
}
