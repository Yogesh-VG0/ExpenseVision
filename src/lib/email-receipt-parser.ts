/**
 * Email receipt parser — scaffolding for future implementation.
 *
 * This module defines the types and stub pipeline for parsing receipt
 * emails forwarded to the app's ingest address. The actual webhook
 * receiver and email provider integration is documented in
 * docs/email-forwarding-architecture.md.
 */

export interface EmailReceiptPayload {
  /** Sender email address */
  from: string;
  /** Email subject line */
  subject: string;
  /** Plain text body */
  textBody: string;
  /** HTML body */
  htmlBody: string;
  /** Attachments */
  attachments: EmailAttachment[];
  /** Raw headers for signature validation */
  headers: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  /** Base64-encoded content */
  content: string;
}

export interface ParsedEmailReceipt {
  userId: string | null;
  attachments: EmailAttachment[];
  metadata: {
    senderEmail: string;
    subject: string;
  };
}

/**
 * Stub: Parse an inbound email payload and extract receipt data.
 *
 * @todo Implement email provider webhook signature validation
 * @todo Implement user lookup by sender email
 * @todo Implement attachment extraction and validation
 * @todo Wire into OCR pipeline for automatic processing
 */
export function parseEmailReceipt(
  _payload: EmailReceiptPayload
): ParsedEmailReceipt {
  // TODO: Implement actual parsing logic
  // See docs/email-forwarding-architecture.md for the full plan
  throw new Error(
    "Email receipt parsing is not yet implemented. See docs/email-forwarding-architecture.md"
  );
}
