"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import slugify from "slugify";
import { generatePostMarkdown, generateVoicePrompt } from "@/lib/ai";
import { requireActiveAppUser } from "@/lib/auth";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/data";
import { sendEmail } from "@/lib/email";
import { isReactionType } from "@/lib/reactions";

type NotificationType =
  | "repost"
  | "reaction"
  | "comment"
  | "reply"
  | "follow"
  | "share"
  | "message"
  | "collaboration_request"
  | "collaboration_approved"
  | "system";

type NotificationPreferenceKey =
  | "notify_reposts"
  | "notify_reactions"
  | "notify_comments"
  | "notify_replies"
  | "notify_follows"
  | "notify_shares"
  | "notify_messages"
  | "notify_collaborations"
  | "notify_system";

type LinkPreviewData = {
  url: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
};

function preferenceKeyForType(type: NotificationType): NotificationPreferenceKey {
  switch (type) {
    case "repost":
      return "notify_reposts";
    case "reaction":
      return "notify_reactions";
    case "comment":
      return "notify_comments";
    case "reply":
      return "notify_replies";
    case "follow":
      return "notify_follows";
    case "share":
      return "notify_shares";
    case "message":
      return "notify_messages";
    case "collaboration_request":
    case "collaboration_approved":
      return "notify_collaborations";
    case "system":
      return "notify_system";
    default:
      return "notify_system";
  }
}

async function notificationEnabledForUser(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  userId: string,
  type: NotificationType,
) {
  const { data } = await service
    .from("notification_preferences")
    .select(
      "notify_reactions,notify_comments,notify_replies,notify_follows,notify_reposts,notify_shares,notify_messages,notify_collaborations,notify_system",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return true;
  return data[preferenceKeyForType(type)] !== false;
}

async function insertNotificationIfEnabled(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  payload: {
    user_id: string;
    type: NotificationType;
    actor_id: string | null;
    post_id: string | null;
    conversation_id?: string | null;
    message: string;
  },
) {
  if (payload.type === "message" && payload.conversation_id) {
    const { data: participant } = await service
      .from("conversation_participants")
      .select("muted_until")
      .eq("conversation_id", payload.conversation_id)
      .eq("user_id", payload.user_id)
      .maybeSingle();
    if (participant?.muted_until && new Date(participant.muted_until).getTime() > Date.now()) {
      return;
    }
  }
  const enabled = await notificationEnabledForUser(service, payload.user_id, payload.type);
  if (!enabled) return;
  const { conversation_id, ...rest } = payload;
  const { error } = await service.from("notifications").insert({
    ...rest,
    conversation_id: conversation_id ?? null,
  });
  if (error) console.error("insertNotificationIfEnabled", payload.type, error);
  if (!error) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const { data: recipient } = await service
      .from("users")
      .select("email")
      .eq("id", payload.user_id)
      .maybeSingle();
    if (recipient?.email) {
      const subjectByType: Record<NotificationType, string> = {
        repost: "New repost on Curiosity60Seconds",
        reaction: "New reaction on Curiosity60Seconds",
        comment: "New comment on Curiosity60Seconds",
        reply: "New reply on Curiosity60Seconds",
        follow: "New follower on Curiosity60Seconds",
        share: "A post was shared with you",
        message: "New message on Curiosity60Seconds",
        collaboration_request: "New collaboration request",
        collaboration_approved: "Collaboration update",
        system: "Account update from Curiosity60Seconds",
      };
      await sendEmail({
        to: recipient.email,
        subject: subjectByType[payload.type] ?? "Notification from Curiosity60Seconds",
        html: `
          <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
            <h2 style="margin:0 0 12px;">Curiosity60Seconds</h2>
            <p style="margin:0 0 12px;">${payload.message}</p>
            <p style="margin:0 0 16px;">
              <a href="${payload.conversation_id ? `${appUrl}/messages?c=${payload.conversation_id}` : appUrl}" style="color:#1b4332; font-weight:600;">Open Curiosity60Seconds</a>
            </p>
            <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;" />
            <p style="margin:0; font-size:12px; color:#6b7280;">
              You are receiving this because you have an account on Curiosity60Seconds.
            </p>
          </div>
        `,
      });
    }
  }
}

async function sendEmailIfEnabled(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  userId: string,
  type: NotificationType,
  params: { subject: string; message: string; linkPath?: string },
) {
  const enabled = await notificationEnabledForUser(service, userId, type);
  if (!enabled) return;
  const { data: recipient } = await service
    .from("users")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!recipient?.email) return;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const link = params.linkPath ? `${appUrl}${params.linkPath}` : appUrl;
  await sendEmail({
    to: recipient.email,
    subject: params.subject,
    html: `
      <div style="font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <h2 style="margin:0 0 12px;">Curiosity60Seconds</h2>
        <p style="margin:0 0 12px;">${params.message}</p>
        <p style="margin:0 0 16px;">
          <a href="${link}" style="color:#1b4332; font-weight:600;">Open Curiosity60Seconds</a>
        </p>
        <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;" />
        <p style="margin:0; font-size:12px; color:#6b7280;">
          You are receiving this because you have an account on Curiosity60Seconds.
        </p>
      </div>
    `,
  });
}

async function insertSystemAlert(params: {
  user_id: string | null;
  type: string;
  message: string;
  category: string;
}) {
  const service = await createSupabaseServiceClient();
  const { error } = await service.from("system_alerts").insert({
    user_id: params.user_id,
    type: params.type,
    message: params.message,
    category: params.category,
  });
  if (error) console.error("insertSystemAlert", error);
}

export async function signUpAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw new Error(error.message);
  redirect("/onboarding");
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);

  const user = await getCurrentAppUser();
  if (user?.status === "suspended") {
    await supabase.auth.signOut();
    throw new Error("Your account has been suspended. Please contact support.");
  }
  if (user?.status === "deleted") {
    await supabase.auth.signOut();
    throw new Error("This account no longer exists.");
  }
  redirect(user?.onboarded ? "/dashboard" : "/onboarding");
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function onboardingAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const storage = await createSupabaseServiceClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getCurrentAppUser();
  if (!profile) redirect("/login");
  if (profile.status !== "active") redirect("/login");
  if (profile.onboarded) redirect("/dashboard");

  const name = String(formData.get("name") ?? "");
  const username = String(formData.get("username") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const preferences = String(formData.get("preferences") ?? "");
  const writingSamples = [
    String(formData.get("sample1") ?? ""),
    String(formData.get("sample2") ?? ""),
    String(formData.get("sample3") ?? ""),
  ];

  let photo_url: string | null = null;
  const photo = formData.get("photo") as File | null;
  if (photo && photo.size > 0) {
    const path = `${user.id}/profile-${Date.now()}-${photo.name}`;
    const { error } = await storage.storage
      .from("profile-photos")
      .upload(path, photo, { upsert: true });
    if (!error) {
      photo_url = storage.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
    }
  }

  let voicePrompt = "Write in a clear, personal voice with citations.";
  try {
    voicePrompt = await generateVoicePrompt({ writingSamples, preferences });
  } catch {
    voicePrompt = `${preferences}\nKeep a personal and thoughtful tone.`;
  }

  const { error: updateError } = await supabase.from("users").update({
    name,
    username: slugify(username, { lower: true, strict: true }),
    bio,
    photo_url,
    writing_samples: writingSamples,
    voice_prompt: voicePrompt,
    onboarded: true,
  }).eq("id", user.id);

  if (updateError) throw new Error(updateError.message);

  await storage.from("notification_preferences").upsert(
    {
      user_id: user.id,
    },
    { onConflict: "user_id" },
  );

  await insertSystemAlert({
    user_id: user.id,
    type: "onboarding_complete",
    message: `User ${profile.email} completed onboarding.`,
    category: "new_signup",
  });

  redirect("/dashboard");
}

export async function generatePostAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const storage = await createSupabaseServiceClient();

  const question = String(formData.get("question") ?? "");
  const rawSources = String(formData.get("rawSources") ?? "");
  const urls = String(formData.get("urls") ?? "");
  const labels = String(formData.get("labels") ?? "");
  const captions = String(formData.get("captions") ?? "");

  const { data: draft, error: draftError } = await supabase
    .from("posts")
    .insert({
      user_id: appUser.id,
      title: "Generating...",
      slug: `draft-${Date.now()}`,
      raw_input: { question, rawSources, urls, labels, captions },
      status: "draft",
    })
    .select("id")
    .single();
  if (draftError || !draft) throw new Error("Failed to create draft");

  const imageFiles = formData.getAll("images").filter((item): item is File => item instanceof File);
  const imageEntries: Array<{ url: string; caption: string; sourceLabel: string }> = [];
  for (let i = 0; i < imageFiles.length; i += 1) {
    const file = imageFiles[i];
    if (!file || file.size === 0) continue;
    const path = `${appUser.id}/${draft.id}/${Date.now()}-${file.name}`;
    const { error } = await storage.storage.from("post-images").upload(path, file, { upsert: true });
    if (!error) {
      const url = storage.storage.from("post-images").getPublicUrl(path).data.publicUrl;
      imageEntries.push({
        url,
        caption: captions.split("\n")[i] ?? "",
        sourceLabel: labels.split("\n")[i] ?? "",
      });
    }
  }

  const textUrls = urls
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  await Promise.all(
    textUrls.map((url, i) =>
      supabase.from("sources").insert({
        post_id: draft.id,
        url,
        quote: rawSources.slice(0, 500),
        source_label: labels.split("\n")[i] ?? `Source ${i + 1}`,
      }),
    ),
  );

  await Promise.all(
    imageEntries.map((img) =>
      supabase.from("sources").insert({
        post_id: draft.id,
        image_url: img.url,
        image_caption: img.caption,
        source_label: img.sourceLabel,
      }),
    ),
  );

  const todayUtc = new Date().toISOString().slice(0, 10);
  const lastGen =
    appUser.last_generation_date == null
      ? null
      : String(appUser.last_generation_date).slice(0, 10);

  let effectiveGenerationCount = appUser.daily_generation_count;
  if (lastGen !== todayUtc) {
    const { error: resetError } = await supabase
      .from("users")
      .update({ daily_generation_count: 0, last_generation_date: todayUtc })
      .eq("id", appUser.id);
    if (resetError) throw new Error(resetError.message);
    effectiveGenerationCount = 0;
  }

  const canUseClaude = effectiveGenerationCount < appUser.daily_generation_limit;
  if (!canUseClaude) {
    await insertSystemAlert({
      user_id: appUser.id,
      type: "daily_generation_limit",
      message: `User ${appUser.email} hit daily generation limit (${appUser.daily_generation_limit}) at ${new Date().toISOString()}.`,
      category: "limit_reached",
    });
  }

  let generated;
  try {
    generated = await generatePostMarkdown({
      user: appUser,
      input: { question, rawSources, imageEntries },
      useClaude: canUseClaude,
    });
  } catch {
    generated = await generatePostMarkdown({
      user: appUser,
      input: { question, rawSources, imageEntries },
      useClaude: false,
    });
  }

  await supabase
    .from("posts")
    .update({
      title: generated.title,
      slug: generated.slug || `post-${Date.now()}`,
      body_md: generated.markdown,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", draft.id);

  if (canUseClaude) {
    await supabase
      .from("users")
      .update({
        daily_generation_count: effectiveGenerationCount + 1,
        last_generation_date: todayUtc,
      })
      .eq("id", appUser.id);
  }

  revalidatePath("/dashboard");
  redirect(`/u/${appUser.username}/${generated.slug}`);
}

export async function updatePostAction(formData: FormData) {
  const appUser = await requireActiveAppUser();

  const postId = String(formData.get("postId") ?? "");
  const title = String(formData.get("title") ?? "Untitled");
  const body = String(formData.get("body_md") ?? "");
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id,user_id,status")
    .eq("id", postId)
    .single();
  if (!post) throw new Error("Post not found");
  let isApprovedCollaborator = false;
  if (post.user_id !== appUser.id && appUser.role !== "admin") {
    const { data: collaboration } = await supabase
      .from("collaborations")
      .select("id")
      .eq("post_id", postId)
      .eq("requester_id", appUser.id)
      .eq("status", "admin_approved")
      .maybeSingle();
    isApprovedCollaborator = !!collaboration;
  }
  if (post.user_id !== appUser.id && appUser.role !== "admin" && !isApprovedCollaborator) {
    redirect("/dashboard");
  }

  const updates: {
    title: string;
    body_md: string;
    status: string;
    published_at?: string | null;
  } = { title, body_md: body, status: "draft" };

  if (post.status === "published") {
    updates.status = "published";
    updates.published_at = new Date().toISOString();
  } else if (post.status === "unpublished") {
    updates.status = "unpublished";
    updates.published_at = null;
  } else {
    updates.status = "draft";
  }

  let query = supabase.from("posts").update(updates).eq("id", postId);

  if (appUser.role !== "admin") {
    query = query.eq("user_id", appUser.id);
  }

  await query;
  revalidatePath("/dashboard");
}

async function getPostPublicPath(postId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();
  const author = pathRow?.users as { username: string } | undefined;
  if (!author?.username || !pathRow?.slug) return null;
  return `/u/${author.username}/${pathRow.slug}`;
}

export async function togglePostPublishedAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id,user_id,status,slug")
    .eq("id", postId)
    .single();
  if (!post || post.user_id !== appUser.id) throw new Error("Not allowed");

  if (post.status === "published") {
  await supabase
      .from("posts")
      .update({ status: "unpublished", published_at: null })
      .eq("id", postId)
      .eq("user_id", appUser.id);
  } else {
    await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", postId)
      .eq("user_id", appUser.id);
  }

  revalidatePath("/dashboard");
  if (appUser.username) {
    revalidatePath(`/u/${appUser.username}`);
    revalidatePath(`/u/${appUser.username}/${post.slug}`);
  }
}

export async function requestPostDeletionAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id,user_id,status,title,slug")
    .eq("id", postId)
    .single();
  if (!post || post.user_id !== appUser.id) throw new Error("Not allowed");

  const updates: Record<string, unknown> = {
    deletion_requested_at: new Date().toISOString(),
  };
  if (post.status === "published") {
    updates.status = "unpublished";
    updates.published_at = null;
  }

  const { error } = await supabase.from("posts").update(updates).eq("id", postId).eq("user_id", appUser.id);
  if (error) throw new Error(error.message);

  const service = await createSupabaseServiceClient();
  await service.from("system_alerts").insert({
    user_id: appUser.id,
    type: "post_deletion_requested",
    message: `Post deletion requested: "${post.title}" (${post.slug}, id ${postId})`,
    category: "deletion_request",
  });

  revalidatePath("/dashboard");
  revalidatePath("/admin", "layout");
}

export async function cancelPostDeletionAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: post } = await supabase
    .from("posts")
    .select("id,user_id,slug,deletion_requested_at,deletion_approved_at")
    .eq("id", postId)
    .single();
  if (!post || post.user_id !== appUser.id) throw new Error("Not allowed");
  if (!post.deletion_requested_at || post.deletion_approved_at != null) {
    throw new Error("No pending deletion request for this post.");
  }

  const { error } = await supabase
    .from("posts")
    .update({
      deletion_requested_at: null,
      status: "published",
      published_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  if (appUser.username) {
    revalidatePath(`/u/${appUser.username}`);
    revalidatePath(`/u/${appUser.username}/${post.slug}`);
  }
}

export async function cancelAccountDeletionAction(_formData: FormData) {
  void _formData;
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: null })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function approvePostDeletionAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: post } = await service
    .from("posts")
    .select("id,title,slug,user_id")
    .eq("id", postId)
    .maybeSingle();
  const { error } = await service
    .from("posts")
    .update({ deletion_approved_at: new Date().toISOString() })
    .eq("id", postId);
  if (error) throw new Error(error.message);
  if (post) {
    const { data: owner } = await service.from("users").select("username").eq("id", post.user_id).maybeSingle();
    await sendEmailIfEnabled(service, post.user_id, "system", {
      subject: "Your post deletion was approved",
      message: `Your deletion request for "${post.title}" was approved. Your post will be removed after 30 days unless policies change.`,
      linkPath: owner?.username ? `/u/${owner.username}/${post.slug}` : "/dashboard",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function rejectPostDeletionAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: post } = await service
    .from("posts")
    .select("id,title,slug,user_id")
    .eq("id", postId)
    .maybeSingle();
  const { error } = await service.from("posts").update({ deletion_requested_at: null }).eq("id", postId);
  if (error) throw new Error(error.message);
  if (post) {
    const { data: owner } = await service.from("users").select("username").eq("id", post.user_id).maybeSingle();
    await sendEmailIfEnabled(service, post.user_id, "system", {
      subject: "Your post deletion was rejected",
      message: `Your deletion request for "${post.title}" was rejected by an admin.`,
      linkPath: owner?.username ? `/u/${owner.username}/${post.slug}` : "/dashboard",
    });
  }
  revalidatePath("/admin", "layout");
  revalidatePath("/dashboard");
}

export async function rejectAccountDeletionAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: targetUser } = await service
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await service.from("users").update({ deletion_requested_at: null }).eq("id", userId);
  if (error) throw new Error(error.message);
  if (targetUser) {
    await sendEmailIfEnabled(service, targetUser.id, "system", {
      subject: "Your account deletion request was cancelled",
      message: "An admin cancelled your account deletion request.",
      linkPath: "/settings/danger",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function requestAccountDeletionAction(_formData: FormData) {
  void _formData;
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);

  const service = await createSupabaseServiceClient();
  await service.from("system_alerts").insert({
    user_id: appUser.id,
    type: "account_deletion_requested",
    message: `Account deletion requested for ${appUser.email}`,
    category: "account_request",
  });

  revalidatePath("/admin", "layout");
  redirect("/settings?accountDeletion=requested");
}

export async function approveAccountDeletionAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: targetUser } = await service
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await service
    .from("users")
    .update({ deletion_approved_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error(error.message);
  if (targetUser) {
    await sendEmailIfEnabled(service, targetUser.id, "system", {
      subject: "Your account deletion was approved",
      message: "Your account deletion request was approved. Your account is scheduled for removal after 30 days.",
      linkPath: "/settings/danger",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function updateSettingsAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const storage = await createSupabaseServiceClient();

  const name = String(formData.get("name") ?? "");
  const bio = String(formData.get("bio") ?? "");
  const samples = [
    String(formData.get("sample1") ?? ""),
    String(formData.get("sample2") ?? ""),
    String(formData.get("sample3") ?? ""),
  ];
  const preferences = String(formData.get("preferences") ?? "");
  const removePhoto = formData.get("removePhoto") === "on";
  let photoUrl = removePhoto ? null : appUser.photo_url;
  const photo = formData.get("photo") as File | null;

  if (!removePhoto && photo && photo.size > 0) {
    const path = `${appUser.id}/profile-${Date.now()}-${photo.name}`;
    const { error } = await storage.storage
      .from("profile-photos")
      .upload(path, photo, { upsert: true });
    if (error) throw new Error(error.message);
    photoUrl = storage.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
  }

  const existingSamples = [
    appUser.writing_samples?.[0] ?? "",
    appUser.writing_samples?.[1] ?? "",
    appUser.writing_samples?.[2] ?? "",
  ];
  const writingSamplesChanged = samples.some((sample, index) => sample !== existingSamples[index]);
  const preferencesChanged = preferences !== (appUser.preferences ?? "");
  const shouldRegenerateVoicePrompt = writingSamplesChanged || preferencesChanged;

  const { error: saveError } = await supabase
    .from("users")
    .update({
      name,
      bio,
      preferences,
      photo_url: photoUrl,
      writing_samples: samples,
    })
    .eq("id", appUser.id);
  if (saveError) throw new Error(saveError.message);

  if (shouldRegenerateVoicePrompt) {
    try {
      const regeneratedVoicePrompt = await generateVoicePrompt({
        writingSamples: samples,
        preferences,
      });

  await supabase
        .from("users")
        .update({ voice_prompt: regeneratedVoicePrompt })
        .eq("id", appUser.id);
    } catch (error) {
      console.error("Voice prompt regeneration failed after settings save", error);
      try {
        const alerts = await createSupabaseServiceClient();
        const failedAt = new Date().toISOString();
        await alerts.from("system_alerts").insert({
          user_id: appUser.id,
          type: "voice_prompt_failed",
          message: `Voice prompt regeneration failed for user ${appUser.id} at ${failedAt}.`,
          category: "content",
        });
      } catch (alertError) {
        console.error("Failed to write system alert", alertError);
      }
    }
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${appUser.username}`);
}

export async function updateProfileSettingsAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const storage = await createSupabaseServiceClient();

  const name = String(formData.get("name") ?? "").trim();
  const usernameInput = String(formData.get("username") ?? "").trim();
  const bio = String(formData.get("bio") ?? "").trim();
  const removePhoto = formData.get("removePhoto") === "on";
  let photoUrl = removePhoto ? null : appUser.photo_url;
  const photo = formData.get("photo") as File | null;

  if (!removePhoto && photo && photo.size > 0) {
    const path = `${appUser.id}/profile-${Date.now()}-${photo.name}`;
    const { error } = await storage.storage
      .from("profile-photos")
      .upload(path, photo, { upsert: true });
    if (error) throw new Error(error.message);
    photoUrl = storage.storage.from("profile-photos").getPublicUrl(path).data.publicUrl;
  }

  const normalizedUsername = slugify(usernameInput, { lower: true, strict: true });
  if (!normalizedUsername) throw new Error("Username cannot be empty.");

  const { error } = await supabase
    .from("users")
    .update({
      name,
      username: normalizedUsername,
      bio,
      photo_url: photoUrl,
    })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/profile");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${normalizedUsername}`);
  if (appUser.username && appUser.username !== normalizedUsername) {
    revalidatePath(`/u/${appUser.username}`);
  }
}

export async function updateVoiceSettingsAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const samples = [
    String(formData.get("sample1") ?? "").trim(),
    String(formData.get("sample2") ?? "").trim(),
    String(formData.get("sample3") ?? "").trim(),
  ];
  const preferences = String(formData.get("preferences") ?? "").trim();

  const { error } = await supabase
    .from("users")
    .update({
      writing_samples: samples,
      preferences,
    })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/voice");
  revalidatePath("/settings");
}

export async function regenerateVoicePromptAction() {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const writingSamples = [
    appUser.writing_samples?.[0] ?? "",
    appUser.writing_samples?.[1] ?? "",
    appUser.writing_samples?.[2] ?? "",
  ];
  const preferences = appUser.preferences ?? "";

  let voicePrompt = appUser.voice_prompt ?? "Write in a clear, personal voice with citations.";
  try {
    voicePrompt = await generateVoicePrompt({ writingSamples, preferences });
  } catch {
    voicePrompt = `${preferences}\nKeep a personal and thoughtful tone.`;
  }

  const { error } = await supabase
    .from("users")
    .update({ voice_prompt: voicePrompt })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);

  revalidatePath("/settings/voice");
  revalidatePath("/settings");
}

export async function updateAccountCredentialsAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const email = String(formData.get("email") ?? "").trim();
  const newPassword = String(formData.get("newPassword") ?? "");
  if (!email) throw new Error("Email is required.");

  const { error: authError } = await supabase.auth.updateUser({
    email,
    password: newPassword.trim() ? newPassword : undefined,
  });
  if (authError) throw new Error(authError.message);

  const { error: profileError } = await supabase
    .from("users")
    .update({ email })
    .eq("id", appUser.id);
  if (profileError) throw new Error(profileError.message);

  revalidatePath("/settings/account");
  revalidatePath("/settings");
}

export async function dismissAlertAction(formData: FormData) {
  const alertId = String(formData.get("alertId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  await service.from("system_alerts").update({ resolved: true }).eq("id", alertId);
  revalidatePath("/admin", "layout");
}

export async function suspendUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: targetUser } = await service
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await service.from("users").update({ status: "suspended" }).eq("id", userId);
  if (error) throw new Error(error.message);
  if (targetUser) {
    await sendEmailIfEnabled(service, targetUser.id, "system", {
      subject: "Your account has been suspended",
      message: "Your Curiosity60Seconds account has been suspended. Please contact support if this is unexpected.",
      linkPath: "/login",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function restoreUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { error } = await service.from("users").update({ status: "active" }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

export async function deleteUserAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");
  const service = await createSupabaseServiceClient();
  const { error } = await service.from("users").update({ status: "deleted" }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

export async function promoteToAdminAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { data: targetUser } = await service
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await service.from("users").update({ role: "admin" }).eq("id", userId);
  if (error) throw new Error(error.message);
  if (targetUser) {
    await sendEmailIfEnabled(service, targetUser.id, "system", {
      subject: "You were promoted to admin",
      message: "You now have admin access on Curiosity60Seconds.",
      linkPath: "/admin/overview",
    });
  }
  revalidatePath("/admin", "layout");
}

export async function demoteFromAdminAction(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");
  if (userId === appUser.id) {
    throw new Error("You cannot demote yourself.");
  }

  const service = await createSupabaseServiceClient();
  const { error } = await service.from("users").update({ role: "user" }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin", "layout");
}

export async function followUserAction(formData: FormData) {
  const targetUserId = String(formData.get("userId") ?? "").trim();
  if (!targetUserId) throw new Error("Missing user.");

  const appUser = await requireActiveAppUser();
  if (targetUserId === appUser.id) throw new Error("You cannot follow yourself.");

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("users")
    .select("username")
    .eq("id", targetUserId)
    .eq("onboarded", true)
    .eq("status", "active")
    .maybeSingle();

  if (!target?.username) throw new Error("User not found.");

  const { error } = await supabase.from("follows").insert({
    follower_id: appUser.id,
    following_id: targetUserId,
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }

  if (!error) {
    const service = await createSupabaseServiceClient();
    const actorLabel = appUser.name?.trim() || appUser.username || "Someone";
    await insertNotificationIfEnabled(service, {
      user_id: targetUserId,
      type: "follow",
      actor_id: appUser.id,
      post_id: null,
      message: `${actorLabel} started following you.`,
    });
  }

  revalidatePath(`/u/${target.username}`);
  revalidatePath("/feed");
  revalidatePath("/people");
}

export async function unfollowUserAction(formData: FormData) {
  const targetUserId = String(formData.get("userId") ?? "").trim();
  if (!targetUserId) throw new Error("Missing user.");

  const appUser = await requireActiveAppUser();
  if (targetUserId === appUser.id) throw new Error("You cannot unfollow yourself.");

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase
    .from("users")
    .select("username")
    .eq("id", targetUserId)
    .maybeSingle();

  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", appUser.id)
    .eq("following_id", targetUserId);

  if (error) throw new Error(error.message);

  if (target?.username) {
    revalidatePath(`/u/${target.username}`);
  }
  revalidatePath("/feed");
  revalidatePath("/people");
}

export async function toggleReactionAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  const reactionType = String(formData.get("reactionType") ?? "").trim();
  if (!postId || !isReactionType(reactionType)) {
    throw new Error("Invalid reaction.");
  }

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("reactions")
    .select("id")
     .eq("post_id", postId)
    .eq("user_id", appUser.id)
    .eq("type", reactionType)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("reactions").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("reactions").insert({
      post_id: postId,
      user_id: appUser.id,
      type: reactionType,
    });
    if (error) throw new Error(error.message);

    const { data: post } = await supabase
      .from("posts")
      .select("user_id,title")
      .eq("id", postId)
      .maybeSingle();

    if (post && post.user_id !== appUser.id) {
      const service = await createSupabaseServiceClient();
      const actorLabel = appUser.name?.trim() || appUser.username || "Someone";
      await insertNotificationIfEnabled(service, {
        user_id: post.user_id,
        type: "reaction",
        actor_id: appUser.id,
        post_id: postId,
        message: `${actorLabel} reacted to your post: ${post.title}`,
      });
    }
  }

  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();

  const author = pathRow?.users as { username: string } | undefined;
  if (author?.username && pathRow?.slug) {
    revalidatePath(`/u/${author.username}/${pathRow.slug}`);
  }
}

export async function repostAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) throw new Error("Missing post.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,user_id,title,status")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post) throw new Error("Post not found.");
  if (post.status !== "published") throw new Error("Only published posts can be reposted.");
  if (post.user_id === appUser.id) throw new Error("You cannot repost your own post.");

  const { error: insertError } = await supabase.from("reposts").insert({
    post_id: postId,
    user_id: appUser.id,
  });

  if (insertError) {
    if (insertError.code === "23505") throw new Error("You already reposted this.");
    throw new Error(insertError.message);
  }

  const reposterLabel = appUser.name?.trim() || appUser.username || "Someone";

  const notifications: Array<{
    user_id: string;
    type: NotificationType;
    actor_id: string;
    post_id: string;
    message: string;
  }> = [
    {
      user_id: post.user_id,
      type: "repost",
      actor_id: appUser.id,
      post_id: postId,
      message: `${reposterLabel} reposted your post "${post.title}".`,
    },
  ];

  const { data: followerRows } = await service
    .from("follows")
    .select("follower_id")
    .eq("following_id", appUser.id);

  for (const row of followerRows ?? []) {
    if (row.follower_id === post.user_id) continue;
    notifications.push({
      user_id: row.follower_id,
      type: "repost",
      actor_id: appUser.id,
      post_id: postId,
      message: `${reposterLabel} reposted a post.`,
    });
  }

  for (const notification of notifications) {
    await insertNotificationIfEnabled(service, {
      user_id: notification.user_id,
      type: notification.type,
      actor_id: notification.actor_id,
      post_id: notification.post_id,
      message: notification.message,
    });
  }

  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();

  const author = pathRow?.users as { username: string } | undefined;
  if (author?.username && pathRow?.slug) {
    revalidatePath(`/u/${author.username}/${pathRow.slug}`);
  }
  revalidatePath("/feed");
}

export async function undoRepostAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) throw new Error("Missing post.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("reposts")
    .delete()
     .eq("post_id", postId)
    .eq("user_id", appUser.id);

  if (error) throw new Error(error.message);

  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();

  const author = pathRow?.users as { username: string } | undefined;
  if (author?.username && pathRow?.slug) {
    revalidatePath(`/u/${author.username}/${pathRow.slug}`);
  }
  revalidatePath("/feed");
}

export type ShareableUserRow = {
  id: string;
  name: string | null;
  username: string | null;
  photo_url: string | null;
};

async function messagingPairBlocked(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  userIdA: string,
  userIdB: string,
) {
  const [{ data: a }, { data: b }] = await Promise.all([
    service.from("blocked_users").select("id").eq("blocker_id", userIdA).eq("blocked_id", userIdB).maybeSingle(),
    service.from("blocked_users").select("id").eq("blocker_id", userIdB).eq("blocked_id", userIdA).maybeSingle(),
  ]);
  return !!(a || b);
}

async function createDmConversation(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  userIdA: string,
  userIdB: string,
) {
  const [{ data: aFollowsB }, { data: bFollowsA }] = await Promise.all([
    service.from("follows").select("id").eq("follower_id", userIdA).eq("following_id", userIdB).maybeSingle(),
    service.from("follows").select("id").eq("follower_id", userIdB).eq("following_id", userIdA).maybeSingle(),
  ]);
  const mutual = !!(aFollowsB && bFollowsA);
  const { data: conv, error: convErr } = await service
    .from("conversations")
    .insert({ is_group: false })
    .select("id")
    .single();
  if (convErr || !conv) throw new Error(convErr?.message ?? "Could not start conversation.");
  const { error: pErr } = await service.from("conversation_participants").insert([
    { conversation_id: conv.id, user_id: userIdA, is_request: false, is_admin: false },
    { conversation_id: conv.id, user_id: userIdB, is_request: !mutual, is_admin: false },
  ]);
  if (pErr) throw new Error(pErr.message);
  return conv.id as string;
}

async function getOrCreateDmConversationId(
  service: Awaited<ReturnType<typeof createSupabaseServiceClient>>,
  userIdA: string,
  userIdB: string,
) {
  const { data: aRows } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userIdA);
  const convIds = [...new Set((aRows ?? []).map((r) => r.conversation_id))];
  if (convIds.length === 0) {
    return createDmConversation(service, userIdA, userIdB);
  }
  const { data: bRows } = await service
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", userIdB)
    .in("conversation_id", convIds);
  const shared = new Set((bRows ?? []).map((r) => r.conversation_id));
  const { data: convRows } = shared.size
    ? await service.from("conversations").select("id,hidden_for").in("id", Array.from(shared))
    : { data: [] as Array<{ id: string; hidden_for: string[] | null }> };
  const convById = new Map((convRows ?? []).map((row) => [row.id, row]));
  for (const cid of shared) {
    const { count } = await service
      .from("conversation_participants")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", cid);
    if (count === 2) {
      const hiddenFor = convById.get(cid)?.hidden_for ?? [];
      const hidden = hiddenFor.includes(userIdA) || hiddenFor.includes(userIdB);
      if (!hidden) return cid;
    }
  }
  return createDmConversation(service, userIdA, userIdB);
}

export async function searchShareableUsersAction(query: string): Promise<ShareableUserRow[]> {
  const appUser = await requireActiveAppUser();
  const token = query.trim().replace(/%/g, "").replace(/_/g, "").slice(0, 48);
  if (!token) return [];

  const supabase = await createSupabaseServerClient();
  const pattern = `%${token}%`;

  const [{ data: byName }, { data: byUser }] = await Promise.all([
    supabase
      .from("users")
      .select("id,name,username,photo_url")
      .eq("onboarded", true)
      .eq("status", "active")
      .neq("id", appUser.id)
      .ilike("name", pattern)
      .limit(15),
    supabase
      .from("users")
      .select("id,name,username,photo_url")
      .eq("onboarded", true)
      .eq("status", "active")
      .neq("id", appUser.id)
      .ilike("username", pattern)
      .limit(15),
  ]);

  const merged = new Map<string, ShareableUserRow>();
  for (const u of [...(byName ?? []), ...(byUser ?? [])]) {
    merged.set(u.id, u as ShareableUserRow);
  }
  return Array.from(merged.values()).slice(0, 20);
}

export async function sharePostAction(postId: string, recipientIds: string[]): Promise<number> {
  postId = postId.trim();
  if (!postId) throw new Error("Missing post.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const uniqueIds = [...new Set(recipientIds.filter((id) => uuidRe.test(id) && id !== appUser.id))].slice(
    0,
    50,
  );
  if (uniqueIds.length === 0) throw new Error("Select at least one recipient.");

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select("id,title,status")
    .eq("id", postId)
    .maybeSingle();

  if (postError || !post) throw new Error("Post not found.");
  if (post.status !== "published") throw new Error("Only published posts can be shared.");

  const { data: validRecipients } = await supabase
    .from("users")
    .select("id")
    .in("id", uniqueIds)
    .eq("onboarded", true)
    .eq("status", "active");

  const validIdSet = new Set((validRecipients ?? []).map((r) => r.id));
  const finalIds = uniqueIds.filter((id) => validIdSet.has(id));
  if (finalIds.length === 0) throw new Error("No valid recipients.");

  const senderLabel = appUser.name?.trim() || appUser.username || "Someone";
  const titleSnippet = post.title.length > 120 ? `${post.title.slice(0, 117)}…` : post.title;

  let inserted = 0;

  for (const recipientId of finalIds) {
    const { error: shareError } = await supabase.from("shares").insert({
      post_id: postId,
      sender_id: appUser.id,
      recipient_id: recipientId,
    });

    if (shareError?.code === "23505") continue;
    if (shareError) throw new Error(shareError.message);

    await insertNotificationIfEnabled(service, {
      user_id: recipientId,
      type: "share",
      actor_id: appUser.id,
      post_id: postId,
      message: `${senderLabel} shared a post with you: ${titleSnippet}`,
    });

    const blockedShare = await messagingPairBlocked(service, appUser.id, recipientId);
    if (!blockedShare) {
      const dmId = await getOrCreateDmConversationId(service, appUser.id, recipientId);
      const { error: dmErr } = await supabase.from("messages").insert({
        conversation_id: dmId,
        sender_id: appUser.id,
        body: null,
        post_id: postId,
        type: "post_share",
      });
      if (dmErr) console.error("sharePostAction post_share message", dmErr);
    }

    inserted += 1;
  }

  if (inserted === 0) throw new Error("Those users were already shared with for this post.");

  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();

  const author = pathRow?.users as { username: string } | undefined;
  if (author?.username && pathRow?.slug) {
    revalidatePath(`/u/${author.username}/${pathRow.slug}`);
  }

  revalidatePath("/messages");

  return inserted;
}

export async function requestCollaborationAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) throw new Error("Missing post.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id,title,status,user_id")
    .eq("id", postId)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");
  if (post.status !== "published") throw new Error("Only published posts support collaboration.");
  if (post.user_id === appUser.id) throw new Error("You cannot request collaboration on your own post.");

  const { error: requestError } = await supabase.from("collaborations").insert({
    post_id: postId,
    requester_id: appUser.id,
  });
  if (requestError?.code === "23505") throw new Error("You already requested collaboration for this post.");
  if (requestError) throw new Error(requestError.message);

  const requesterLabel = appUser.name?.trim() || appUser.username || "Someone";
  await insertNotificationIfEnabled(service, {
    user_id: post.user_id,
    type: "collaboration_request",
    actor_id: appUser.id,
    post_id: postId,
    message: `${requesterLabel} requested to collaborate on your post "${post.title}".`,
  });

  const { data: pathRow } = await supabase
    .from("posts")
    .select("slug, users!inner(username)")
    .eq("id", postId)
    .maybeSingle();
  const author = pathRow?.users as { username: string } | undefined;
  if (author?.username && pathRow?.slug) {
    revalidatePath(`/u/${author.username}/${pathRow.slug}`);
  }
}

export async function authorApproveCollaborationAction(formData: FormData) {
  const collaborationId = String(formData.get("collaborationId") ?? "").trim();
  if (!collaborationId) throw new Error("Missing collaboration.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: collaboration } = await service
    .from("collaborations")
    .select("id,status,post_id,requester_id")
    .eq("id", collaborationId)
    .maybeSingle();
  if (!collaboration) throw new Error("Collaboration request not found.");

  const { data: post } = await service
    .from("posts")
    .select("id,title,user_id,slug")
    .eq("id", collaboration.post_id)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");
  if (post.user_id !== appUser.id) throw new Error("Only the post author can approve this step.");
  if (collaboration.status === "rejected") throw new Error("Request was already rejected.");
  if (collaboration.status === "admin_approved") throw new Error("Request was already fully approved.");

  const { error: updateError } = await supabase
    .from("collaborations")
    .update({
      status: "author_approved",
      author_approved_at: new Date().toISOString(),
      rejected_at: null,
    })
    .eq("id", collaborationId);
  if (updateError) throw new Error(updateError.message);

  const authorLabel = appUser.name?.trim() || appUser.username || "The author";
  await insertNotificationIfEnabled(service, {
    user_id: collaboration.requester_id,
    type: "collaboration_approved",
    actor_id: appUser.id,
    post_id: collaboration.post_id,
    message: `${authorLabel} approved your collaboration request for "${post.title}". Admin review is pending.`,
  });

  const { error: alertError } = await service.from("system_alerts").insert({
    user_id: null,
    type: "collaboration_admin_review",
    message: `Collaboration request on "${post.title}" is ready for admin approval.`,
    category: "content",
  });
  if (alertError) console.error("authorApproveCollaborationAction system_alert", alertError);

  const { data: owner } = await service.from("users").select("username").eq("id", post.user_id).maybeSingle();
  if (owner?.username) {
    revalidatePath(`/u/${owner.username}/${post.slug}`);
  }
  revalidatePath("/admin/collaboration");
}

export async function adminApproveCollaborationAction(formData: FormData) {
  const collaborationId = String(formData.get("collaborationId") ?? "").trim();
  if (!collaborationId) throw new Error("Missing collaboration.");

  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");
  const service = await createSupabaseServiceClient();

  const { data: collaboration } = await service
    .from("collaborations")
    .select("id,status,post_id,requester_id")
    .eq("id", collaborationId)
    .maybeSingle();
  if (!collaboration) throw new Error("Collaboration request not found.");
  if (collaboration.status !== "author_approved") {
    throw new Error("Only author-approved requests can be admin-approved.");
  }

  const { error: updateError } = await service
    .from("collaborations")
    .update({
      status: "admin_approved",
      admin_approved_at: new Date().toISOString(),
      rejected_at: null,
    })
    .eq("id", collaborationId);
  if (updateError) throw new Error(updateError.message);

  const { data: post } = await service
    .from("posts")
    .select("id,title,slug,user_id")
    .eq("id", collaboration.post_id)
    .maybeSingle();
  if (post) {
    await insertNotificationIfEnabled(service, {
      user_id: collaboration.requester_id,
      type: "collaboration_approved",
      actor_id: appUser.id,
      post_id: collaboration.post_id,
      message: `Admin approved your collaboration request for "${post.title}". You can now edit this post.`,
    });

    const { data: owner } = await service.from("users").select("username").eq("id", post.user_id).maybeSingle();
    if (owner?.username) {
      revalidatePath(`/u/${owner.username}/${post.slug}`);
    }
  }
  revalidatePath("/admin/collaboration");
}

export async function rejectCollaborationAction(formData: FormData) {
  const collaborationId = String(formData.get("collaborationId") ?? "").trim();
  if (!collaborationId) throw new Error("Missing collaboration.");

  const appUser = await requireActiveAppUser();
  const service = await createSupabaseServiceClient();
  const supabase = await createSupabaseServerClient();

  const { data: collaboration } = await service
    .from("collaborations")
    .select("id,post_id,requester_id,status")
    .eq("id", collaborationId)
    .maybeSingle();
  if (!collaboration) throw new Error("Collaboration request not found.");

  const { data: post } = await service
    .from("posts")
    .select("id,title,user_id,slug")
    .eq("id", collaboration.post_id)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");

  const isAdmin = appUser.role === "admin";
  const isAuthor = post.user_id === appUser.id;
  if (!isAdmin && !isAuthor) throw new Error("Only the post author or an admin can reject.");

  const { error: updateError } = await supabase
    .from("collaborations")
    .update({
      status: "rejected",
      rejected_at: new Date().toISOString(),
    })
    .eq("id", collaborationId);
  if (updateError) throw new Error(updateError.message);

  const actorLabel = appUser.name?.trim() || appUser.username || (isAdmin ? "Admin" : "Author");
  await insertNotificationIfEnabled(service, {
    user_id: collaboration.requester_id,
    type: "system",
    actor_id: appUser.id,
    post_id: collaboration.post_id,
    message: `${actorLabel} rejected your collaboration request for "${post.title}".`,
  });

  const { data: owner } = await service.from("users").select("username").eq("id", post.user_id).maybeSingle();
  if (owner?.username) {
    revalidatePath(`/u/${owner.username}/${post.slug}`);
  }
  revalidatePath("/admin/collaboration");
}

export async function addCommentAction(formData: FormData) {
  const postId = String(formData.get("postId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw || null;
  if (!postId || !body) throw new Error("Missing comment details.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: post } = await supabase
    .from("posts")
    .select("id,title,user_id,status")
    .eq("id", postId)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");
  if (post.status !== "published") throw new Error("Comments are only allowed on published posts.");

  let parentUserId: string | null = null;
  if (parentId) {
    const { data: parent } = await supabase
      .from("comments")
      .select("id,user_id,post_id")
      .eq("id", parentId)
      .maybeSingle();
    if (!parent || parent.post_id !== postId) throw new Error("Invalid parent comment.");
    parentUserId = parent.user_id;
  }

  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: appUser.id,
    parent_id: parentId,
    body,
  });
  if (error) throw new Error(error.message);

  const actorLabel = appUser.name?.trim() || appUser.username || "Someone";
  if (post.user_id !== appUser.id) {
    await insertNotificationIfEnabled(service, {
      user_id: post.user_id,
      type: "comment",
      actor_id: appUser.id,
      post_id: postId,
      message: `${actorLabel} commented on your post "${post.title}".`,
    });
  }
  if (parentUserId && parentUserId !== appUser.id && parentUserId !== post.user_id) {
    await insertNotificationIfEnabled(service, {
      user_id: parentUserId,
      type: "reply",
      actor_id: appUser.id,
      post_id: postId,
      message: `${actorLabel} replied to your comment on "${post.title}".`,
    });
  }

  const postPath = await getPostPublicPath(postId);
  if (postPath) revalidatePath(postPath);
}

export async function editCommentAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!commentId || !body) throw new Error("Missing comment details.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: comment } = await supabase
    .from("comments")
    .select("id,user_id,post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) throw new Error("Comment not found.");
  if (comment.user_id !== appUser.id) throw new Error("Not allowed.");

  const { error } = await supabase
    .from("comments")
    .update({ body, updated_at: new Date().toISOString() })
    .eq("id", commentId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);

  const postPath = await getPostPublicPath(comment.post_id);
  if (postPath) revalidatePath(postPath);
}

export async function deleteCommentAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "").trim();
  if (!commentId) throw new Error("Missing comment.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const { data: comment } = await supabase
    .from("comments")
    .select("id,user_id,post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) throw new Error("Comment not found.");

  const { data: post } = await supabase
    .from("posts")
    .select("id,user_id")
    .eq("id", comment.post_id)
    .maybeSingle();
  if (!post) throw new Error("Post not found.");

  const canDelete =
    appUser.role === "admin" || comment.user_id === appUser.id || post.user_id === appUser.id;
  if (!canDelete) throw new Error("Not allowed.");

  const { error } = await supabase
    .from("comments")
    .update({
      deleted: true,
      body: "",
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId);
  if (error) throw new Error(error.message);

  const postPath = await getPostPublicPath(comment.post_id);
  if (postPath) revalidatePath(postPath);
}

export async function reportCommentAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!commentId) throw new Error("Missing comment.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: comment } = await supabase
    .from("comments")
    .select("id,post_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) throw new Error("Comment not found.");

  const { error: reportError } = await supabase.from("comment_reports").insert({
    comment_id: commentId,
    reporter_id: appUser.id,
    reason: reason || null,
  });
  if (reportError?.code !== "23505" && reportError) throw new Error(reportError.message);

  const { error: updateError } = await supabase
    .from("comments")
    .update({ reported: true })
    .eq("id", commentId);
  if (updateError) throw new Error(updateError.message);

  const { error: alertError } = await service.from("system_alerts").insert({
    user_id: appUser.id,
    type: "comment_reported",
    message: `Comment ${commentId} was reported${reason ? `: ${reason}` : "."}`,
    category: "content",
  });
  if (alertError) console.error("reportCommentAction alert", alertError);

  const postPath = await getPostPublicPath(comment.post_id);
  if (postPath) revalidatePath(postPath);
}

export async function dismissCommentReportAction(formData: FormData) {
  const commentId = String(formData.get("commentId") ?? "").trim();
  if (!commentId) throw new Error("Missing comment.");

  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");
  const service = await createSupabaseServiceClient();

  const { error: deleteReportsError } = await service
    .from("comment_reports")
    .delete()
    .eq("comment_id", commentId);
  if (deleteReportsError) throw new Error(deleteReportsError.message);

  const { error: updateCommentError } = await service
    .from("comments")
    .update({ reported: false })
    .eq("id", commentId);
  if (updateCommentError) throw new Error(updateCommentError.message);

  revalidatePath("/admin/content");
}

export async function markNotificationsReadAction() {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", appUser.id)
    .eq("read", false);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

export async function markSingleNotificationReadAction(formData: FormData) {
  const notificationId = String(formData.get("notificationId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "").trim();
  if (!notificationId) throw new Error("Missing notification.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", notificationId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
  if (redirectTo) redirect(redirectTo);
}

export async function clearReadNotificationsAction() {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", appUser.id)
    .eq("read", true);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
}

export async function updateNotificationPreferencesAction(formData: FormData) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();

  const payload = {
    user_id: appUser.id,
    notify_reactions: formData.get("notify_reactions") === "on",
    notify_comments: formData.get("notify_comments") === "on",
    notify_replies: formData.get("notify_replies") === "on",
    notify_follows: formData.get("notify_follows") === "on",
    notify_reposts: formData.get("notify_reposts") === "on",
    notify_shares: formData.get("notify_shares") === "on",
    notify_messages: formData.get("notify_messages") === "on",
    notify_collaborations: formData.get("notify_collaborations") === "on",
    notify_system: formData.get("notify_system") === "on",
  };

  const { error } = await supabase
    .from("notification_preferences")
    .upsert(payload, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}

export async function recordPostViewAction(postId: string, durationSeconds?: number) {
  const cleanPostId = postId.trim();
  if (!cleanPostId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("post_views").insert({
    post_id: cleanPostId,
    viewer_id: user?.id ?? null,
    duration_seconds:
      typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds >= 0
        ? Math.floor(durationSeconds)
        : null,
  });
  if (error) throw new Error(error.message);
}

export async function recordProfileViewAction(profileUserId: string) {
  const cleanProfileUserId = profileUserId.trim();
  if (!cleanProfileUserId) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("profile_views").insert({
    profile_user_id: cleanProfileUserId,
    viewer_id: user?.id ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function getOrCreateConversationAction(otherUserId: string): Promise<string> {
  const clean = otherUserId.trim();
  if (!clean) throw new Error("Missing user.");
  const appUser = await requireActiveAppUser();
  if (clean === appUser.id) throw new Error("You cannot message yourself.");

  const service = await createSupabaseServiceClient();
  const { data: other } = await service
    .from("users")
    .select("id,status,onboarded")
    .eq("id", clean)
    .maybeSingle();
  if (!other || other.status !== "active" || !other.onboarded) {
    throw new Error("User not found.");
  }
  if (await messagingPairBlocked(service, appUser.id, clean)) {
    throw new Error("Messaging is not available for this user.");
  }
  const id = await getOrCreateDmConversationId(service, appUser.id, clean);
  revalidatePath("/messages");
  return id;
}

export async function sendMessageAction(
  conversationId: string,
  body: string,
  postId?: string | null,
  parentMessageId?: string | null,
  options?: { imageUrl?: string | null; linkPreview?: LinkPreviewData | null },
) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: parts } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", convId);
  if (!parts?.some((p) => p.user_id === appUser.id)) throw new Error("Not a participant.");

  const otherId = parts.find((p) => p.user_id !== appUser.id)?.user_id;
  if (otherId && (await messagingPairBlocked(service, appUser.id, otherId))) {
    throw new Error("Messaging is not available for this user.");
  }
  const { data: conversation } = await service.from("conversations").select("hidden_for,is_group").eq("id", convId).maybeSingle();
  const hiddenFor = Array.isArray(conversation?.hidden_for) ? conversation.hidden_for : [];
  const shouldForkDm = !!otherId && !conversation?.is_group && (hiddenFor.includes(appUser.id) || hiddenFor.includes(otherId));
  const targetConvId = shouldForkDm ? await createDmConversation(service, appUser.id, otherId) : convId;

  const cleanPostId = postId?.trim() || null;
  const cleanParentMessageId = parentMessageId?.trim() || null;
  const cleanImageUrl = options?.imageUrl?.trim() || null;
  const type = cleanImageUrl ? "image" : cleanPostId ? "post_share" : "text";
  const trimmed = body.trim();

  if (type === "text" && !trimmed) throw new Error("Message cannot be empty.");
  if (type === "post_share" && !cleanPostId) throw new Error("Missing post.");
  if (type === "image" && !cleanImageUrl) throw new Error("Missing image.");

  if (type === "post_share") {
    const { data: post } = await supabase.from("posts").select("id,status").eq("id", cleanPostId).maybeSingle();
    if (!post || post.status !== "published") throw new Error("Invalid post.");
  }

  if (cleanParentMessageId) {
    const { data: parent } = await supabase
      .from("messages")
      .select("id,conversation_id")
      .eq("id", cleanParentMessageId)
      .maybeSingle();
    if (!parent || parent.conversation_id !== targetConvId) throw new Error("Invalid reply target.");
  }

  const { error: insErr } = await supabase.from("messages").insert({
    conversation_id: targetConvId,
    sender_id: appUser.id,
    body: type === "text" || type === "image" ? (trimmed || null) : null,
    post_id: type === "post_share" ? cleanPostId : null,
    image_url: type === "image" ? cleanImageUrl : null,
    link_preview: options?.linkPreview ?? null,
    parent_message_id: cleanParentMessageId,
    type,
  });
  if (insErr) throw new Error(insErr.message);

  if (otherId) {
    const actorLabel = appUser.name?.trim() || appUser.username || "Someone";
    const preview =
      type === "post_share"
        ? `${actorLabel} shared a post with you`
        : type === "image"
          ? `${actorLabel} sent an image${trimmed ? `: ${trimmed.slice(0, 80)}` : ""}`
        : `${actorLabel}: ${trimmed.length > 120 ? `${trimmed.slice(0, 117)}…` : trimmed}`;
    await insertNotificationIfEnabled(service, {
      user_id: otherId,
      type: "message",
      actor_id: appUser.id,
      post_id: type === "post_share" ? cleanPostId : null,
      conversation_id: targetConvId,
      message: preview,
    });
  }

  revalidatePath("/messages");
}

export async function sendImageMessageAction(conversationId: string, file: File, caption?: string, parentMessageId?: string | null) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  if (!(file instanceof File) || file.size <= 0) throw new Error("Missing image file.");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed.");

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
  const safeExt = (ext ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const appUser = await requireActiveAppUser();
  const storage = await createSupabaseServiceClient();
  const path = `${appUser.id}/${convId}/msg-${Date.now()}-${crypto.randomUUID()}.${safeExt || "jpg"}`;
  const { error: uploadError } = await storage.storage.from("message-images").upload(path, file, { upsert: false });
  if (uploadError) throw new Error(uploadError.message);
  const imageUrl = storage.storage.from("message-images").getPublicUrl(path).data.publicUrl;
  await sendMessageAction(convId, caption ?? "", null, parentMessageId ?? null, { imageUrl, linkPreview: null });
}

export async function muteConversationAction(conversationId: string, durationHours: number) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const mutedUntil =
    durationHours >= 9999
      ? "2099-01-01T00:00:00.000Z"
      : new Date(Date.now() + Math.max(1, durationHours) * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ muted_until: mutedUntil })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function unmuteConversationAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ muted_until: null })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function acceptMessageRequestAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ is_request: false })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function declineMessageRequestAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: part } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (!part) throw new Error("Not allowed.");
  const service = await createSupabaseServiceClient();
  const { data: conv } = await service.from("conversations").select("hidden_for").eq("id", convId).maybeSingle();
  const hidden = Array.isArray(conv?.hidden_for) ? [...conv.hidden_for] : [];
  if (!hidden.includes(appUser.id)) hidden.push(appUser.id);
  const { error } = await service.from("conversations").update({ hidden_for: hidden }).eq("id", convId);
  if (error) throw new Error(error.message);
  const { error: reqErr } = await service
    .from("conversation_participants")
    .update({ is_request: false })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (reqErr) throw new Error(reqErr.message);
  revalidatePath("/messages");
}

export async function deleteConversationForSelfAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: part } = await supabase
    .from("conversation_participants")
    .select("id")
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (!part) throw new Error("Not allowed.");
  const service = await createSupabaseServiceClient();
  const { data: conv } = await service.from("conversations").select("hidden_for").eq("id", convId).maybeSingle();
  const hidden = Array.isArray(conv?.hidden_for) ? [...conv.hidden_for] : [];
  if (!hidden.includes(appUser.id)) hidden.push(appUser.id);
  const { error } = await service.from("conversations").update({ hidden_for: hidden }).eq("id", convId);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function createGroupConversationAction(name: string, participantIds: string[]) {
  const appUser = await requireActiveAppUser();
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Group name is required.");
  const cleanedIds = [...new Set(participantIds.map((id) => id.trim()).filter(Boolean).filter((id) => id !== appUser.id))];
  if (cleanedIds.length === 0) throw new Error("Add at least one participant.");
  const service = await createSupabaseServiceClient();
  const { data: users } = await service
    .from("users")
    .select("id")
    .in("id", cleanedIds)
    .eq("onboarded", true)
    .eq("status", "active");
  const validIds = (users ?? []).map((u) => u.id);
  if (validIds.length === 0) throw new Error("No valid participants.");
  const { data: conv, error: convErr } = await service
    .from("conversations")
    .insert({ name: cleanName, is_group: true })
    .select("id")
    .single();
  if (convErr || !conv) throw new Error(convErr?.message ?? "Could not create group.");
  const rows = [
    { conversation_id: conv.id, user_id: appUser.id, is_admin: true, is_request: false },
    ...validIds.map((id) => ({ conversation_id: conv.id, user_id: id, is_admin: false, is_request: false })),
  ];
  const { error: partErr } = await service.from("conversation_participants").insert(rows);
  if (partErr) throw new Error(partErr.message);
  revalidatePath("/messages");
  return conv.id as string;
}

export async function addGroupMemberAction(conversationId: string, userId: string) {
  const convId = conversationId.trim();
  const target = userId.trim();
  if (!convId || !target) throw new Error("Missing data.");
  const appUser = await requireActiveAppUser();
  const service = await createSupabaseServiceClient();
  const { data: me } = await service
    .from("conversation_participants")
    .select("is_admin")
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (!me?.is_admin) throw new Error("Only group admins can add members.");
  const { error } = await service.from("conversation_participants").insert({
    conversation_id: convId,
    user_id: target,
    is_admin: false,
    is_request: false,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/messages");
}

export async function removeGroupMemberAction(conversationId: string, userId: string) {
  const convId = conversationId.trim();
  const target = userId.trim();
  if (!convId || !target) throw new Error("Missing data.");
  const appUser = await requireActiveAppUser();
  const service = await createSupabaseServiceClient();
  const { data: me } = await service
    .from("conversation_participants")
    .select("is_admin")
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (!me?.is_admin) throw new Error("Only group admins can remove members.");
  const { error } = await service
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("user_id", target);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function leaveGroupAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) throw new Error("Missing conversation.");
  const appUser = await requireActiveAppUser();
  const service = await createSupabaseServiceClient();
  const { error } = await service
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function updatePrivacySettingsAction(showOnlineStatus: boolean) {
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("users")
    .update({ show_online_status: showOnlineStatus })
    .eq("id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings/privacy");
}

export async function editMessageAction(messageId: string, newBody: string) {
  const id = messageId.trim();
  const body = newBody.trim();
  if (!id) throw new Error("Missing message.");
  if (!body) throw new Error("Message cannot be empty.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: message } = await supabase
    .from("messages")
    .select("id,sender_id,type,deleted")
    .eq("id", id)
    .maybeSingle();
  if (!message) throw new Error("Message not found.");
  if (message.sender_id !== appUser.id) throw new Error("Not allowed.");
  if (message.type !== "text") throw new Error("Only text messages can be edited.");
  if (message.deleted) throw new Error("Cannot edit deleted message.");
  const { error } = await supabase
    .from("messages")
    .update({ body, edited_at: new Date().toISOString() })
    .eq("id", id)
    .eq("sender_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function deleteMessageAction(messageId: string) {
  const id = messageId.trim();
  if (!id) throw new Error("Missing message.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: message } = await supabase
    .from("messages")
    .select("id,sender_id")
    .eq("id", id)
    .maybeSingle();
  if (!message) throw new Error("Message not found.");
  if (message.sender_id !== appUser.id) throw new Error("Not allowed.");
  const { error } = await supabase
    .from("messages")
    .update({ deleted: true, edited_at: null })
    .eq("id", id)
    .eq("sender_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

const ALLOWED_MESSAGE_EMOJIS = new Set(["👍", "❤️", "😂", "😮", "😢", "🙏"]);

export async function toggleMessageReactionAction(messageId: string, emoji: string) {
  const id = messageId.trim();
  const icon = emoji.trim();
  if (!id || !icon || !ALLOWED_MESSAGE_EMOJIS.has(icon)) throw new Error("Invalid reaction.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", id)
    .eq("user_id", appUser.id)
    .eq("emoji", icon)
    .maybeSingle();
  if (existing) {
    const { error } = await supabase.from("message_reactions").delete().eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("message_reactions").insert({
      message_id: id,
      user_id: appUser.id,
      emoji: icon,
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/messages");
}

export async function markConversationReadAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) return;
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function setConversationTypingAction(conversationId: string) {
  const convId = conversationId.trim();
  if (!convId) return;
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const until = new Date(Date.now() + 10000).toISOString();
  await supabase
    .from("conversation_participants")
    .update({ typing_until: until })
    .eq("conversation_id", convId)
    .eq("user_id", appUser.id);
}

export async function reportMessageAction(messageId: string, reason?: string | null) {
  const id = messageId.trim();
  if (!id) throw new Error("Missing message.");

  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const service = await createSupabaseServiceClient();

  const { data: msg } = await supabase
    .from("messages")
    .select("id,conversation_id,sender_id,hidden_for")
    .eq("id", id)
    .maybeSingle();
  if (!msg) throw new Error("Message not found.");

  const { data: part } = await supabase
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", msg.conversation_id)
    .eq("user_id", appUser.id)
    .maybeSingle();
  if (!part) throw new Error("Not allowed.");

  const { error: repErr } = await supabase.from("message_reports").insert({
    message_id: id,
    reporter_id: appUser.id,
    reason: reason?.trim() || null,
  });
  if (repErr && repErr.code !== "23505") throw new Error(repErr.message);

  const hidden = Array.isArray(msg.hidden_for) ? [...msg.hidden_for] : [];
  if (!hidden.includes(appUser.id)) hidden.push(appUser.id);

  const { error: upErr } = await service
    .from("messages")
    .update({ reported: true, hidden_for: hidden })
    .eq("id", id);
  if (upErr) throw new Error(upErr.message);

  await insertSystemAlert({
    user_id: appUser.id,
    type: "message_reported",
    message: `Message ${id} was reported in conversation ${msg.conversation_id}.`,
    category: "content",
  });
  revalidatePath("/messages");
}

export async function blockUserAction(userId: string) {
  const target = userId.trim();
  if (!target) throw new Error("Missing user.");
  const appUser = await requireActiveAppUser();
  if (target === appUser.id) throw new Error("You cannot block yourself.");
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("blocked_users").insert({
    blocker_id: appUser.id,
    blocked_id: target,
  });
  if (error && error.code !== "23505") throw new Error(error.message);
  revalidatePath("/messages");
}

export async function unblockUserAction(userId: string) {
  const target = userId.trim();
  if (!target) throw new Error("Missing user.");
  const appUser = await requireActiveAppUser();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", appUser.id)
    .eq("blocked_id", target);
  if (error) throw new Error(error.message);
  revalidatePath("/messages");
}

export async function adminDismissMessageReportAction(formData: FormData) {
  const messageId = String(formData.get("messageId") ?? "").trim();
  if (!messageId) throw new Error("Missing message.");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { error: delErr } = await service.from("message_reports").delete().eq("message_id", messageId);
  if (delErr) throw new Error(delErr.message);
  const { error: upErr } = await service.from("messages").update({ reported: false }).eq("id", messageId);
  if (upErr) throw new Error(upErr.message);
  revalidatePath("/admin/content");
}

export async function adminDeleteReportedMessageAction(formData: FormData) {
  const messageId = String(formData.get("messageId") ?? "").trim();
  if (!messageId) throw new Error("Missing message.");
  const appUser = await getCurrentAppUser();
  if (!appUser || appUser.role !== "admin") redirect("/dashboard");

  const service = await createSupabaseServiceClient();
  const { error } = await service.from("messages").delete().eq("id", messageId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/content");
}