// /lib/gmail.ts
import { google } from "googleapis";

export function getGmail() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REFRESH_TOKEN,
    GOOGLE_REDIRECT_URI,
  } = process.env;

  const oauth2 = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  return google.gmail({ version: "v1", auth: oauth2 });
}
