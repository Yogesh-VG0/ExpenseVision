# Email Forwarding Architecture (Phase G — scaffolding)

## Overview

Email receipt forwarding allows users to forward receipt emails to a designated address (e.g., `receipts@expensevision.tech`) for automatic ingestion.

## Architecture Proposal

### Inbound Email Processing

1. **Email service integration** — Use a transactional email service with inbound processing (e.g., SendGrid Inbound Parse, Postmark Inbound, Mailgun Routes).
2. **Webhook receiver** — Implement a `/api/receipts/email-ingest` endpoint that receives parsed email payloads from the email provider.
3. **Parser pipeline**:
   - Extract sender and match to user by registered email address
   - Extract attached images and PDFs (the receipt itself)
   - Fall back to scanning the HTML email body for structured receipt data
4. **Processing** — Route extracted files through the existing OCR pipeline
5. **Notification** — Create an `import_complete` notification for the user

### Security Considerations

- Validate webhook signatures from the email provider
- Rate-limit inbound emails per user
- Scan attachments for malware before processing
- Reject emails not matching a registered user

### Database Schema (future)

```sql
CREATE TABLE public.email_imports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  sender_email text NOT NULL,
  subject text,
  attachment_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Implementation Order

1. Set up email service account and inbound domain
2. Implement webhook receiver with signature validation
3. Build email parser (extract attachments + metadata)
4. Wire into existing OCR pipeline
5. Add user-facing email forwarding address in settings
6. Add import history view

## Status

This is scaffolding documentation only. The webhook receiver and email parser are stubbed in `src/lib/email-receipt-parser.ts` for future implementation.
