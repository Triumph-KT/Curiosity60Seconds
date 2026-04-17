# Curiosity60Seconds

## What it is
A knowledge sharing platform and social network. Users paste any raw search results (links, text, screenshots, AI-generated answers) they came across during their normal day to day lifestyle, and the platform synthesizes it into a cited, structured blog post published instantly to their public profile. It is a full social platform with following, reactions, comments, reposts, sharing, direct messaging, notifications, and a complete admin system. The posts are the blogs each user publish.

## Architecture Overview
Include a section that describes the full system architecture:
- Frontend and backend: Next.js 16 App Router with server components, server actions, and API routes (describ what features (each page that) have been developed)
- Database: PostgreSQL via Supabase with Row Level Security on all 20+ tables
- Authentication: Supabase Auth with email/password and Google OAuth
- File storage: Supabase Storage with three public buckets
- AI pipeline: Anthropic Claude API (primary) with Ollama local model (automatic fallback), voice prompt generation from user writing samples
- Email: nodemailer with Gmail SMTP for transactional emails and 3-day activity digests
- Deployment: Vercel

## Database Schema
List all tables with a one-line description of each:
- users: user profiles, roles, voice prompts, generation limits, presence, privacy settings
- posts: published knowledge posts with Markdown body, slug, status, deletion tracking
- sources: citations and images linked to each post
- audit_log: automatic record of all database changes via Postgres triggers
- system_alerts: platform health alerts visible to admins
- follows: user follow relationships
- reactions: post reactions (learned, researched, followup)
- reposts: post reposts with author notification
- notifications: in-app notifications for all social interactions
- notification_preferences: per-user notification settings for each event type
- shares: post sharing tracking
- collaborations: collaboration requests and co-authoring workflow with two-step approval
- comments: threaded comments on posts with soft delete
- comment_reports: reported comments for admin review
- post_views: every post view with viewer ID and duration for analytics
- profile_views: profile page views for monthly unique visitor tracking
- conversations: direct message and group conversations
- conversation_participants: members of each conversation with read receipts, typing, mute, and request status
- messages: individual messages with support for text, images, post shares, replies, reactions, edit and delete
- message_reactions: emoji reactions on individual messages
- message_reports: reported messages for admin review
- blocked_users: user block relationships

## Tech Stack
- Next.js 16 (App Router, React 19, TypeScript)
- Tailwind CSS 4
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Anthropic Claude API
- Ollama (local LLM fallback)
- nodemailer with Gmail SMTP
- recharts for admin analytics charts
- react-markdown with remark-gfm for post rendering
- Vercel for deployment

## Local Setup
Step by step:
1. Clone the repo and cd into the project
2. Run npm install
3. Copy .env.example to .env.local
4. Create a Supabase project, copy URL, anon key, and service role key into .env.local
5. Run supabase/schema.sql in the Supabase SQL Editor
6. Create three public storage buckets in Supabase Storage named exactly: profile-photos, post-images, message-images
7. In Supabase Authentication, disable email confirmation for local development
8. Set up Google OAuth: create a Google Cloud project, create OAuth 2.0 credentials, add the Supabase callback URL as an authorized redirect URI, paste Client ID and Secret into Supabase Authentication Providers Google
9. Add Gmail app password: go to Google Account Security, create an App Password for Curiosity60Seconds, paste into GMAIL_APP_PASSWORD
10. Run npm run dev and open http://localhost:3000

## Environment Variables
Full table with every variable, what it does, and whether it is required or optional:

| Variable | Required | What it does |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Required | Supabase project URL used by browser and server Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Required | Supabase anon key used for client-side authenticated requests |
| `SUPABASE_SERVICE_ROLE_KEY` | Required | Service role key for privileged server actions and backend-only operations |
| `NEXT_PUBLIC_APP_URL` | Required | Base app URL for OAuth redirects, canonical URLs, and email links |
| `ANTHROPIC_API_KEY` | Required | API key for Anthropic Claude post generation and voice prompt creation |
| `CLAUDE_MODEL` | Optional | Claude model override |
| `OLLAMA_ENDPOINT` | Optional | Ollama API endpoint used for automatic fallback generation |
| `OLLAMA_MODEL` | Optional | Ollama model name used for fallback generation |
| `ADMIN_SETUP_KEY` | Required | One-time admin bootstrap key for `/admin-setup` |
| `GMAIL_USER` | Required | Gmail sender account for nodemailer SMTP |
| `GMAIL_APP_PASSWORD` | Required | Gmail app password for SMTP authentication |
| `DIGEST_SECRET` | Required | Secret checked by `POST /api/digest` via `x-digest-secret` header |

## First Admin Setup
After signing up visit /admin-setup, enter your ADMIN_SETUP_KEY, and you are promoted to admin. This only works once. Additional admins can be promoted from Admin panel Users section.

## Seeding Test Data
Run supabase/seed.sql in the Supabase SQL Editor to insert 10 fake users and 30 posts. Seed users have no auth accounts and cannot log in. They exist for testing admin features, the feed, and the people directory. Delete seed data before opening to real users by running the delete queries in the seed file comments.

## AI Pipeline
Claude is used for post generation and voice prompt creation. Daily generation limit per user defaults to 10, tracked in users.daily_generation_count and reset daily. When the limit is reached or Claude fails for any reason, the system automatically falls back to Ollama with no error shown to the user. Voice prompts are generated from three writing samples provided during onboarding and regenerated only when samples or preferences change.

## Email System
nodemailer with Gmail SMTP sends transactional emails for: account suspended, deletion approved, reactions, comments, follows, reposts, shares, collaboration requests and approvals, post deletion events, admin promotion, and a 3-day activity digest for inactive users. All emails respect per-user notification preferences. To trigger the digest manually call POST /api/digest with header x-digest-secret matching your DIGEST_SECRET env var.

## Deployment to Vercel
1. Push to GitHub and import in Vercel
2. Add all environment variables from .env.example including SUPABASE_SERVICE_ROLE_KEY
3. Set NEXT_PUBLIC_APP_URL to your production Vercel URL
4. Add the production URL to Supabase Authentication URL Configuration
5. Turn email confirmation back on in Supabase Authentication for production
6. Delete seed data before going live
7. Deploy

## Key Features
List all major features in grouped sections: Knowledge Publishing, Social Features, Messaging, Admin System, Analytics

### Knowledge Publishing
- AI-assisted synthesis from raw research into structured, cited Markdown posts
- Public profile publishing and slug-based public post pages
- Source and image citation support for traceable outputs
- Voice-style personalization via user writing samples and preferences

### Social Features
- Follow/unfollow graph and people discovery
- Reactions, comments/replies, reposts, and post sharing
- Notification center with per-event user preferences
- Profile and post view tracking for audience insights

### Messaging
- Direct and group conversations
- Message requests, accept/decline workflow, conversation muting
- Text/image/post-share messaging with replies, reactions, edit/delete
- Read receipts, typing status, link previews, blocking/reporting

### Admin System
- One-time admin bootstrap with secure setup key
- User moderation (suspension, deletion workflows, promotions)
- Content moderation for comments/messages/reports
- System alerts and audit trail visibility

### Analytics
- Platform overview metrics and growth trends
- Engagement, retention, and message-volume analysis
- Peak activity breakdowns
- SEO & discovery dashboards for indexed content performance
