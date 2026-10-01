/**
 * Step 1 of connecting a Microsoft account: the address of Microsoft's
 * sign-in and consent, for the signed-in person's browser to go to (see
 * _shared/oauth.ts).
 */
import { serveOAuthStart } from "../_shared/oauth.ts";

serveOAuthStart("outlook");
