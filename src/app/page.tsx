import Link from "next/link";
import type { Metadata } from "next";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Curiosity60Seconds — Turn research into published insight in 60 seconds",
  description:
    "Paste sources, links, and images. AI generates a cited article in your voice and publishes it instantly.",
  alternates: {
    canonical: absoluteUrl("/"),
  },
  openGraph: {
    title: "Curiosity60Seconds — Turn research into published insight in 60 seconds",
    description:
      "Paste sources, links, and images. AI generates a cited article in your voice and publishes it instantly.",
    url: absoluteUrl("/"),
    type: "website",
  },
};

export default function Home() {
  return (
    <>
      <section className="mb-16 w-screen ml-[calc(50%-50vw)] bg-primary px-6 pb-24 pt-16 text-white md:pb-32 md:pt-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-4 max-w-3xl mx-auto text-sm font-semibold leading-snug text-accent md:text-base">
            Turn any internet search into a published, cited page in 60 seconds
          </p>
          <h1 className="mb-6 text-3xl font-bold leading-snug tracking-tight md:text-4xl lg:text-[2.5rem] lg:leading-tight">
            What did you learn today on the internet or the news? That is a blog, and we write it for you in 60
            seconds.
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-white/85 md:text-xl">
            Paste links, notes, or screenshots of the things you googled online to learn something. We turn
            them into a fully written article in your voice and publish it instantly under your name.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-5">
            <Link
              href="/signup"
              className="inline-flex min-w-[200px] items-center justify-center rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-foreground shadow-lg transition hover:bg-accent-hover"
            >
              Create your first post
            </Link>
            <Link
              href="/people"
              className="inline-flex min-w-[200px] items-center justify-center rounded-xl border-2 border-white bg-transparent px-8 py-3.5 text-base font-semibold text-white transition hover:bg-white/10"
            >
              Explore real posts
            </Link>
          </div>
          <p className="mt-10 text-lg font-medium text-accent md:text-xl">
            Stop losing what you learn. Turn it into something that lasts.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16">
        <section>
          <h2 className="mb-12 text-center text-2xl font-bold text-foreground md:text-3xl">How it works</h2>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-8 transition hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                1
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">Capture your curiosity</h3>
              <p className="leading-relaxed text-muted">
                Drop in questions, snippets, URLs, and images. Everything stays in one place so nothing gets
                lost between tabs and notes.
              </p>
            </div>
            <div className="card p-8 transition hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent/20 text-xl font-bold text-foreground">
                2
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">We write it for you</h3>
              <p className="leading-relaxed text-muted">
                The AI uses your sources and writes in your voice — not generic AI output. A real article with
                structure, citations, and your name on it.
              </p>
            </div>
            <div className="card p-8 transition hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                3
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">Publish instantly to the world</h3>
              <p className="leading-relaxed text-muted">
                One click sends your piece live on your public profile—shareable, linkable, and ready for your
                audience.
              </p>
            </div>
            <div className="card border-l-4 border-l-accent p-8 transition hover:shadow-md">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
                4
              </div>
              <h3 className="mb-3 text-xl font-semibold text-foreground">Your knowledge lives forever</h3>
              <p className="leading-relaxed text-muted">
                Every post lands on your public profile, indexed by Google, findable by anyone. Your curiosity
                becomes a permanent public record.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-4">
          <p className="mb-6 text-center text-sm font-semibold uppercase tracking-wide text-primary">
            This is what your research becomes.
          </p>
          <article className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-border bg-surface shadow-md">
            <div className="border-b border-border px-8 py-8 md:px-10 md:py-10">
              <h1 className="text-balance text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl lg:text-[2rem]">
                Why Did Trump Post Himself as Jesus on Social Media?
              </h1>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
                  aria-hidden
                >
                  AK
                </div>
                <p className="text-sm text-muted">
                  By <span className="font-medium text-foreground">A. Kimani</span> · April 13, 2026
                </p>
              </div>
            </div>

            <div className="space-y-8 px-8 py-8 md:px-10 md:pb-10">
              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground md:text-xl">The Image</h2>
                <p className="leading-relaxed text-muted">
                  In April 2026, President Donald Trump shared an AI-generated image on Truth Social depicting
                  himself in flowing white and red robes, one hand raised over a sick person&apos;s head, bathed
                  in radiant light with patriotic symbols in the background. The image closely resembled
                  traditional Christian iconography of Jesus healing the sick.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground md:text-xl">The Context</h2>
                <p className="leading-relaxed text-muted">
                  The post appeared hours after Trump publicly attacked Pope Leo XIV, who had condemned
                  Trump&apos;s handling of the U.S.-Iran war. Trump called the Pope &apos;WEAK on crime&apos; and
                  &apos;terrible for Foreign Policy&apos; before sharing the image. Many observers saw the timing as
                  deliberate provocation.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground md:text-xl">
                  Trump&apos;s Explanation
                </h2>
                <p className="leading-relaxed text-muted">
                  When reporters asked about the image, Trump claimed he thought it showed him as a doctor or
                  Red Cross worker making people better. He said he deleted it because people were
                  &apos;confused&apos; but offered no apology. Speaker Mike Johnson confirmed he personally urged
                  the president to take it down.
                </p>
              </section>

              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground md:text-xl">The Reaction</h2>
                <p className="leading-relaxed text-muted">
                  The post drew rare criticism even from evangelical and Catholic conservatives who labeled it
                  blasphemous. Analysts suggested the image tapped into Christian nationalist sentiment, with
                  some supporters viewing Trump as a messianic figure. J.D. Vance framed it as Trump &apos;just
                  stirring things up.&apos;
                </p>
              </section>

              <section className="border-t border-border pt-8">
                <h2 className="mb-3 text-base font-semibold text-foreground">Citations</h2>
                <p className="text-xs leading-relaxed text-muted md:text-sm">
                  Mediaite · Washington Post · CNN · New York Times · Yahoo News · The Print
                </p>
              </section>
            </div>
          </article>
        </section>
      </div>
    </>
  );
}
