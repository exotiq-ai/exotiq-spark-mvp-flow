# Auth email templates

Branded templates for the Supabase Auth emails (recovery, magic link, confirmation, invite, email change, reauthentication), in the same dark-card style as the renter emails. They use Supabase's template variables (`{{ .ConfirmationURL }}`, `{{ .Email }}`, `{{ .NewEmail }}`, `{{ .Token }}`).

They are applied to a project with the management API (`PATCH /v1/projects/<ref>/config/auth`, fields `mailer_templates_<name>_content` and `mailer_subjects_<name>`), together with the custom SMTP sender (`smtp_host smtp.resend.com`, `smtp_user resend`, `smtp_pass` = the Resend API key, `smtp_admin_email noreply@mail.exotiq.ai`, `smtp_sender_name Exotiq`). The sender domain must be verified in Resend. Applied to the rehearsal on 2026-11-01; apply to production at the cutover (runbook step T-24h).
