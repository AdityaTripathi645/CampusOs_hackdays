export const ROLES = ["ADMIN", "ORGANIZER", "PARTICIPANT", "JUDGE"] as const;
export type Role = (typeof ROLES)[number];

export const SCORING_METHODS = ["MEAN", "MEDIAN", "TRIMMED_MEAN"] as const;
export type ScoringMethod = (typeof SCORING_METHODS)[number];

export const REGISTRATION_STATUSES = ["PENDING", "APPROVED", "WAITLISTED", "REJECTED", "WITHDRAWN"] as const;
export type RegistrationStatus = (typeof REGISTRATION_STATUSES)[number];

export const SUBMISSION_STATUSES = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "REJECTED"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export function isScoringMethod(value: string): value is ScoringMethod {
  return SCORING_METHODS.some((method) => method === value);
}

export function isSubmissionStatus(value: string): value is SubmissionStatus {
  return SUBMISSION_STATUSES.some((status) => status === value);
}

export function isRole(value: string): value is Role {
  return ROLES.some((role) => role === value);
}
