# Backups and health

How Casy's data is backed up off Supabase, how to get it back, and how you hear when something breaks (#88).

## What runs

- **A nightly backup** (`.github/workflows/backup.yml`, 03:00 UTC). It dumps roles, schema and data, including the login accounts, encrypts them with `age` to your public key, and keeps them as that run's artifact for 30 days. If a run fails, GitHub emails you.
- **A health check**: the `health` Edge Function, at `https://lymygsndrhgpdqczkzrv.supabase.co/functions/v1/health`. It answers `200 {"ok":true}`, or `503` with `"stale"` (no calendar has synced for three hours, for example because the hourly job stopped) or `"failing"` (over 30% of accounts fail to sync). An uptime monitor watches it, and casy.app, and emails you. Admin mode shows the same status.

## Setting it up (once)

1. **A key pair**, on your Mac:
   ```bash
   brew install age
   age-keygen -o ~/casy-backup-key.txt
   ```
   It prints the public key (`age1...`). The file holds the private key. Put a copy in your password manager. Without it, no backup can ever be opened.
2. **The database connection string**: Supabase dashboard > Connect > **Session pooler**. Copy it with your database password in it. If you don't know the password, reset it under Database > Settings; the Edge Functions don't use it.
3. **GitHub secrets**: repo > Settings > Secrets and variables > Actions > New repository secret:
   - `SUPABASE_DB_URL`: the connection string;
   - `BACKUP_AGE_RECIPIENT`: the public key `age1...`.
4. **Try it**: Actions > Backup > Run workflow. It should finish green with an artifact named `casy-backup-<date>`.
5. **Uptime monitor** (UptimeRobot's free plan, or similar), with two HTTP monitors that email you:
   - `https://casy.app`;
   - the health URL above. It's down whenever it answers 503.

## Getting a backup back

1. Download the artifact: Actions > Backup > the run > Artifacts. It's a zip holding `casy-backup-<date>.tar.gz.age`.
2. Decrypt and unpack:
   ```bash
   age -d -i ~/casy-backup-key.txt casy-backup-<date>.tar.gz.age | tar -xzf -
   ```
   This gives `roles.sql`, `schema.sql` and `data.sql`.
3. Restore into an **empty** Supabase project (never over the live one):
   ```bash
   psql \
     --single-transaction \
     --variable ON_ERROR_STOP=1 \
     --file roles.sql \
     --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql \
     --dbname "<the new project's connection string>"
   ```
4. **What a backup doesn't hold**, to set up again by hand:
   - **Vault secrets**: the hourly sync reads `calendar_sync_url` and `calendar_sync_secret` from Vault (`20260920120000_calendar_sync.sql`). Vault values are encrypted with the old project's own key, so create them again in the new project.
   - **Function secrets**: all of them (`supabase secrets set`, see CLAUDE.md's Environment Variables), and the Auth settings and the Send Email hook in the dashboard.
   - **`CALDAV_ENCRYPTION_KEY` must be the same key as before.** Every calendar credential in `calendar_secrets` is encrypted with it. With a different key, everyone has to reconnect their calendars.

**Not tried yet:** a test restore needs an empty database to restore into, ideally the local one from #77. Until it has been done once, treat this section as the plan, not a proven procedure.
