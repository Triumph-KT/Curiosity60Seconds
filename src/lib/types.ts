export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  username: string | null;
  photo_url: string | null;
  bio: string | null;
  preferences: string | null;
  writing_samples: string[] | null;
  voice_prompt: string | null;
  onboarded: boolean;
  status: "active" | "suspended" | "deleted";
  role: "user" | "admin";
  daily_generation_count: number;
  daily_generation_limit: number;
  last_generation_date: string | null;
  last_digest_sent_at: string | null;
  deletion_requested_at: string | null;
  deletion_approved_at: string | null;
};

export type Post = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  body_md: string;
  raw_input: Record<string, unknown>;
  status: "draft" | "published" | "unpublished";
  published_at: string | null;
  created_at: string;
  updated_at: string;
  deletion_requested_at: string | null;
  deletion_approved_at: string | null;
};
