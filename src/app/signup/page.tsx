import Link from "next/link";
import { signUpAction } from "@/app/actions";
import { GoogleOAuthSection } from "@/components/google-oauth-section";

export default function SignUpPage() {
  return (
    <div className="card mx-auto max-w-xl space-y-6 p-8 md:p-10">
      <h1 className="page-title">Create account</h1>
      <p className="text-muted">Start publishing in minutes.</p>
      <GoogleOAuthSection />
      <form action={signUpAction} className="grid gap-4">
        <input name="email" type="email" placeholder="Email" className="input-field" required />
        <input name="password" type="password" placeholder="Password" className="input-field" required />
        <button type="submit" className="btn-primary w-full sm:w-auto">
          Sign up
        </button>
      </form>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline hover:text-primary-hover">
          Log in
        </Link>
      </p>
    </div>
  );
}
