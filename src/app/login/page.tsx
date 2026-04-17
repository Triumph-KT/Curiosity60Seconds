import Link from "next/link";
import { loginAction } from "@/app/actions";
import { GoogleOAuthSection } from "@/components/google-oauth-section";

export default function LoginPage() {
  return (
    <div className="card mx-auto max-w-xl space-y-6 p-8 md:p-10">
      <h1 className="page-title">Log in</h1>
      <p className="text-muted">Welcome back. Sign in to continue.</p>
      <GoogleOAuthSection />
      <form action={loginAction} className="grid gap-4">
        <input name="email" type="email" placeholder="Email" className="input-field" required />
        <input name="password" type="password" placeholder="Password" className="input-field" required />
        <button type="submit" className="btn-primary w-full sm:w-auto">
          Log in
        </button>
      </form>
      <p className="text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="font-medium text-primary underline hover:text-primary-hover">
          Sign up
        </Link>
      </p>
    </div>
  );
}
