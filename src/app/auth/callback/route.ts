import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? requestUrl.origin;

  const loginError = () => NextResponse.redirect(new URL("/login?error=oauth", appBase));

  if (!code) {
    return loginError();
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL("/onboarding", appBase));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    console.error("auth callback exchangeCodeForSession", exchangeError);
    return loginError();
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) {
    return loginError();
  }

  let { data: appUser } = await supabase
    .from("users")
    .select("onboarded")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser) {
    const email = user.email?.trim();
    const insertPayload = {
      id: user.id,
      email: email && email.length > 0 ? email : `${user.id}@oauth.placeholder`,
    };
    const { error: insertError } = await supabase.from("users").insert(insertPayload);
    if (insertError && insertError.code !== "23505") {
      console.error("auth callback users insert", insertError);
    }
    const { data: refetched } = await supabase
      .from("users")
      .select("onboarded")
      .eq("id", user.id)
      .maybeSingle();
    appUser = refetched;
  }

  const path = appUser?.onboarded ? "/dashboard" : "/onboarding";
  response.headers.set("Location", new URL(path, appBase).toString());

  return response;
}
