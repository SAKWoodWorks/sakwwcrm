import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const ALLOWED_DOMAIN = "sakww.com";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    signIn({ profile }) {
      const email = profile?.email ?? "";
      return email.endsWith(`@${ALLOWED_DOMAIN}`);
    },
    session({ session, token }) {
      session.user.email = token.email as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
