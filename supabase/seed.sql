begin;

-- Local dev seed data for admin/testing UI.
-- Intentionally writes only to public.users and public.posts.

insert into public.users (
  id,
  email,
  name,
  username,
  photo_url,
  bio,
  preferences,
  writing_samples,
  voice_prompt,
  onboarded,
  role
)
values
  (
    '11111111-1111-1111-1111-111111111111',
    'maya.patel@example.test',
    'Maya Patel',
    'maya-patel',
    'https://i.pravatar.cc/300?img=11',
    'Product designer exploring human-centered AI workflows.',
    'Warm, practical tone with examples.',
    array['Design is decision making.', 'Great products reduce cognitive load.', 'Ship small, learn fast.'],
    'Write clearly with practical takeaways and concrete examples.',
    true,
    'user'
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'eli.thompson@example.test',
    'Eli Thompson',
    'eli-thompson',
    'https://i.pravatar.cc/300?img=12',
    'Backend engineer focused on reliability, observability, and APIs.',
    'Technical but concise, avoid jargon when possible.',
    array['Reliability is a feature.', 'Measure first, optimize second.', 'Simple systems fail less.'],
    'Write in a crisp technical style and explain trade-offs.',
    true,
    'user'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    'sofia.romero@example.test',
    'Sofia Romero',
    'sofia-romero',
    'https://i.pravatar.cc/300?img=13',
    'Data analyst translating complex metrics into decisions.',
    'Analytical voice, include short summaries.',
    array['Context matters as much as counts.', 'Good dashboards answer questions fast.', 'Outliers deserve curiosity.'],
    'Write with clarity, evidence, and actionable conclusions.',
    true,
    'user'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    'noah.kim@example.test',
    'Noah Kim',
    'noah-kim',
    'https://i.pravatar.cc/300?img=14',
    'Developer advocate helping teams ship better documentation.',
    'Friendly and instructional.',
    array['Docs are part of the product.', 'Examples beat abstract rules.', 'Teach by reducing friction.'],
    'Write in an approachable, helpful, example-first style.',
    true,
    'user'
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    'ava.johnson@example.test',
    'Ava Johnson',
    'ava-johnson',
    'https://i.pravatar.cc/300?img=15',
    'Marketing lead studying creator growth and audience trust.',
    'Narrative style with practical lessons.',
    array['Trust compounds over time.', 'Consistency beats sporadic virality.', 'Clarity scales teams.'],
    'Write as a storyteller with actionable advice.',
    true,
    'user'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'liam.okafor@example.test',
    'Liam Okafor',
    'liam-okafor',
    'https://i.pravatar.cc/300?img=16',
    'Security engineer interested in practical threat modeling.',
    'Direct, risk-aware, and pragmatic.',
    array['Security is a product requirement.', 'Small controls prevent large incidents.', 'Assume breach, design recovery.'],
    'Write in a practical security-focused style with clear mitigations.',
    true,
    'user'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'grace.chen@example.test',
    'Grace Chen',
    'grace-chen',
    'https://i.pravatar.cc/300?img=17',
    'PM balancing customer interviews, roadmap, and execution.',
    'Reflective tone, concise bullets.',
    array['Roadmaps are bets, not promises.', 'Interview often, decide deliberately.', 'Outcomes over output.'],
    'Write with strategic focus and practical product examples.',
    true,
    'user'
  ),
  (
    '88888888-8888-8888-8888-888888888888',
    'omar.haddad@example.test',
    'Omar Haddad',
    'omar-haddad',
    'https://i.pravatar.cc/300?img=18',
    'Frontend engineer optimizing performance and accessibility.',
    'Calm, educational style with checklists.',
    array['Performance is user experience.', 'Accessibility benefits everyone.', 'Progressive enhancement wins.'],
    'Write in a developer-friendly style with clear implementation steps.',
    true,
    'user'
  ),
  (
    '99999999-9999-9999-9999-999999999999',
    'nina.bauer@example.test',
    'Nina Bauer',
    'nina-bauer',
    'https://i.pravatar.cc/300?img=19',
    'Operations manager improving systems and team handoffs.',
    'Structured and practical.',
    array['Process should reduce friction.', 'Ownership needs clear boundaries.', 'Retrospectives must create action.'],
    'Write with operational clarity and practical recommendations.',
    true,
    'user'
  ),
  (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'jack.wilson@example.test',
    'Jack Wilson',
    'jack-wilson',
    'https://i.pravatar.cc/300?img=20',
    'Researcher tracking AI policy, ethics, and adoption trends.',
    'Balanced and evidence-based.',
    array['Policy lags technology by default.', 'Adoption follows trust.', 'Governance should be iterative.'],
    'Write in a balanced analytical voice with nuanced trade-offs.',
    true,
    'user'
  )
on conflict (id) do nothing;

insert into public.posts (
  user_id,
  title,
  slug,
  body_md,
  status,
  published_at
)
values
  ('11111111-1111-1111-1111-111111111111', 'Designing Better AI Onboarding Flows', 'designing-better-ai-onboarding-flows', '# Designing Better AI Onboarding Flows\n\nThis is placeholder test content for local development.\n\n## Key Points\n\n- Start with one job-to-be-done.\n- Reduce time-to-first-value.\n- Capture feedback in-product.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '30 days'),
  ('11111111-1111-1111-1111-111111111111', 'Why Empty States Matter in Product UX', 'why-empty-states-matter-in-product-ux', '# Why Empty States Matter in Product UX\n\nPlaceholder markdown body used for admin feature testing.\n\n## Key Points\n\n- Empty states should teach.\n- Include one primary CTA.\n- Keep copy short and empathetic.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '22 days'),
  ('11111111-1111-1111-1111-111111111111', 'Turning User Interviews into Interface Changes', 'turning-user-interviews-into-interface-changes', '# Turning User Interviews into Interface Changes\n\nPlaceholder markdown body used for UI testing.\n\n## Key Points\n\n- Synthesize by behavior patterns.\n- Prioritize recurring friction.\n- Validate before broad rollout.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '14 days'),

  ('22222222-2222-2222-2222-222222222222', 'API Pagination Patterns That Scale', 'api-pagination-patterns-that-scale', '# API Pagination Patterns That Scale\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Prefer cursor pagination for large feeds.\n- Keep response envelopes consistent.\n- Document ordering guarantees.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '31 days'),
  ('22222222-2222-2222-2222-222222222222', 'SLOs for Small Engineering Teams', 'slos-for-small-engineering-teams', '# SLOs for Small Engineering Teams\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Start with one user-critical journey.\n- Define error budgets clearly.\n- Review monthly with product.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '18 days'),
  ('22222222-2222-2222-2222-222222222222', 'Logging Without Leaking Sensitive Data', 'logging-without-leaking-sensitive-data', '# Logging Without Leaking Sensitive Data\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Redact at source.\n- Classify fields by sensitivity.\n- Test logging pipelines in CI.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '9 days'),

  ('33333333-3333-3333-3333-333333333333', 'Three Dashboard Smells to Avoid', 'three-dashboard-smells-to-avoid', '# Three Dashboard Smells to Avoid\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Avoid vanity metrics.\n- Always show trend context.\n- Highlight anomalies intentionally.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '27 days'),
  ('33333333-3333-3333-3333-333333333333', 'A Better Weekly Metrics Review', 'a-better-weekly-metrics-review', '# A Better Weekly Metrics Review\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Pair metrics with decisions.\n- Track assumptions explicitly.\n- End with owners and next steps.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '17 days'),
  ('33333333-3333-3333-3333-333333333333', 'How to Explain Variance to Non-Analysts', 'how-to-explain-variance-to-non-analysts', '# How to Explain Variance to Non-Analysts\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Start with impact first.\n- Use simple ranges over dense stats.\n- Keep confidence language clear.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '6 days'),

  ('44444444-4444-4444-4444-444444444444', 'Docs-First API Design in Practice', 'docs-first-api-design-in-practice', '# Docs-First API Design in Practice\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Draft examples before implementation.\n- Keep terminology stable.\n- Include failure-mode docs.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '25 days'),
  ('44444444-4444-4444-4444-444444444444', 'Making SDK Quickstarts Actually Quick', 'making-sdk-quickstarts-actually-quick', '# Making SDK Quickstarts Actually Quick\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Assume no prior context.\n- Keep first success under 5 minutes.\n- Remove optional complexity early.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '16 days'),
  ('44444444-4444-4444-4444-444444444444', 'When to Add Visual Diagrams to Documentation', 'when-to-add-visual-diagrams-to-documentation', '# When to Add Visual Diagrams to Documentation\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Use diagrams for architecture boundaries.\n- Avoid decorative visuals.\n- Keep diagram source versioned.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '8 days'),

  ('55555555-5555-5555-5555-555555555555', 'Building Trust Through Creator Consistency', 'building-trust-through-creator-consistency', '# Building Trust Through Creator Consistency\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Publish on a reliable cadence.\n- Be explicit about audience value.\n- Measure retention, not just reach.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '29 days'),
  ('55555555-5555-5555-5555-555555555555', 'Simple Messaging Framework for Product Launches', 'simple-messaging-framework-for-product-launches', '# Simple Messaging Framework for Product Launches\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Problem, promise, proof.\n- One audience per message.\n- Align copy with support docs.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '20 days'),
  ('55555555-5555-5555-5555-555555555555', 'What We Learned from a Failed Campaign', 'what-we-learned-from-a-failed-campaign', '# What We Learned from a Failed Campaign\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Diagnose channel mismatch.\n- Fix offer clarity.\n- Iterate with smaller tests.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '10 days'),

  ('66666666-6666-6666-6666-666666666666', 'Practical Threat Modeling for Startups', 'practical-threat-modeling-for-startups', '# Practical Threat Modeling for Startups\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Scope by critical assets.\n- Focus on likely attacker paths.\n- Track mitigations in backlog.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '28 days'),
  ('66666666-6666-6666-6666-666666666666', 'Secrets Management Basics Every Team Needs', 'secrets-management-basics-every-team-needs', '# Secrets Management Basics Every Team Needs\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Never hardcode credentials.\n- Rotate keys regularly.\n- Audit secret access events.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '19 days'),
  ('66666666-6666-6666-6666-666666666666', 'Incident Response Runbooks That Work', 'incident-response-runbooks-that-work', '# Incident Response Runbooks That Work\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Define clear incident roles.\n- Practice tabletop simulations.\n- Capture postmortem actions.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '7 days'),

  ('77777777-7777-7777-7777-777777777777', 'How PMs Can Keep Roadmaps Honest', 'how-pms-can-keep-roadmaps-honest', '# How PMs Can Keep Roadmaps Honest\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Tie roadmap items to outcomes.\n- Re-rank monthly by evidence.\n- Communicate uncertainty clearly.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '26 days'),
  ('77777777-7777-7777-7777-777777777777', 'Interview Templates That Reveal Real Needs', 'interview-templates-that-reveal-real-needs', '# Interview Templates That Reveal Real Needs\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Ask for recent concrete examples.\n- Probe existing workarounds.\n- Separate preference from pain.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '15 days'),
  ('77777777-7777-7777-7777-777777777777', 'A Lightweight Product Decision Log', 'a-lightweight-product-decision-log', '# A Lightweight Product Decision Log\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Record context and trade-offs.\n- Include owner and review date.\n- Revisit when assumptions change.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '5 days'),

  ('88888888-8888-8888-8888-888888888888', 'Frontend Performance Wins Under One Week', 'frontend-performance-wins-under-one-week', '# Frontend Performance Wins Under One Week\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Audit bundle hot paths.\n- Lazy-load noncritical code.\n- Optimize image delivery.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '24 days'),
  ('88888888-8888-8888-8888-888888888888', 'Accessibility Checks That Catch Real Problems', 'accessibility-checks-that-catch-real-problems', '# Accessibility Checks That Catch Real Problems\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Test keyboard navigation first.\n- Validate color contrast early.\n- Use semantic HTML by default.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '13 days'),
  ('88888888-8888-8888-8888-888888888888', 'Reducing Layout Shift in Content-Heavy Pages', 'reducing-layout-shift-in-content-heavy-pages', '# Reducing Layout Shift in Content-Heavy Pages\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Reserve space for media.\n- Avoid late font swaps.\n- Track CLS in production.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '4 days'),

  ('99999999-9999-9999-9999-999999999999', 'Operational Playbooks for Remote Teams', 'operational-playbooks-for-remote-teams', '# Operational Playbooks for Remote Teams\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Make ownership explicit.\n- Standardize escalation paths.\n- Keep docs close to execution.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '23 days'),
  ('99999999-9999-9999-9999-999999999999', 'Improving Handoffs Across Product and Support', 'improving-handoffs-across-product-and-support', '# Improving Handoffs Across Product and Support\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Use shared issue templates.\n- Capture customer impact signals.\n- Close loops with follow-ups.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '12 days'),
  ('99999999-9999-9999-9999-999999999999', 'Retrospectives That Lead to Better Systems', 'retrospectives-that-lead-to-better-systems', '# Retrospectives That Lead to Better Systems\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Focus on system causes.\n- Assign clear action owners.\n- Review actions at next retro.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '3 days'),

  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AI Governance for Fast-Moving Teams', 'ai-governance-for-fast-moving-teams', '# AI Governance for Fast-Moving Teams\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Start with high-risk use cases.\n- Define review checkpoints.\n- Track model and policy drift.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '21 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Policy Gaps in Enterprise AI Adoption', 'policy-gaps-in-enterprise-ai-adoption', '# Policy Gaps in Enterprise AI Adoption\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Procurement lags deployment.\n- Risk ownership is often unclear.\n- Governance needs practical controls.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '11 days'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'How to Communicate AI Risk Without Fear', 'how-to-communicate-ai-risk-without-fear', '# How to Communicate AI Risk Without Fear\n\nPlaceholder body for local seed data.\n\n## Key Points\n\n- Separate risk categories clearly.\n- Pair risks with mitigations.\n- Calibrate language to audience.\n\n## Citations\n\n- Internal test source.', 'published', now() - interval '2 days')
on conflict (user_id, slug) do nothing;

commit;
