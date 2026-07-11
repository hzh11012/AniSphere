import { z } from 'zod';

export const SearchSuggestQuerySchema = z.object({
  keyword: z.string().min(1).max(50)
});

export type SearchSuggestQuery = z.infer<typeof SearchSuggestQuerySchema>;

export const SearchSuggestItemSchema = z.object({
  name: z.string(),
  highlightName: z.string()
});

export const SearchSuggestResponseSchema = z.array(SearchSuggestItemSchema);
