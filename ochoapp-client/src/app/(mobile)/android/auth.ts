import { GitHub, Google } from "arctic";

const MOBILE_API_URL =
  process.env.NEXT_PUBLIC_MOBILE_API_URL || process.env.NEXT_PUBLIC_BASE_URL;

export const google = new Google(
  process.env.GOOGLE_CLIENT_ID!,
  process.env.GOOGLE_CLIENT_SECRET!,
  `${MOBILE_API_URL}/api/android/login/google`,
);
export const github = new GitHub(
  process.env.GITHUB_CLIENT_ID!,
  process.env.GITHUB_CLIENT_SECRET!,
  {
    redirectURI: `${MOBILE_API_URL}/api/auth/callback/github/android`,
  },
);
