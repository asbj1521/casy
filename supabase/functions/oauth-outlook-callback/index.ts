/**
 * Step 2 of connecting a Microsoft account: Microsoft sends the browser back
 * here with a one-time code, and the account is stored (see
 * _shared/oauth.ts).
 */
import { serveOAuthCallback } from "../_shared/oauth.ts";

serveOAuthCallback("outlook");
