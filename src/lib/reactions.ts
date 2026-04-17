export const REACTION_TYPE_KEYS = ["learned", "researched", "followup_question"] as const;

export type ReactionTypeKey = (typeof REACTION_TYPE_KEYS)[number];

export function isReactionType(value: string): value is ReactionTypeKey {
  return (REACTION_TYPE_KEYS as readonly string[]).includes(value);
}
