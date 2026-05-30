import { z } from 'zod';

export const McpInfoSchemaResponse = z.object({
  endpoint: z.string(),
  tokenEnabled: z.boolean(),
  tools: z.array(
    z.object({
      name: z.string(),
      description: z.string()
    })
  ),
  guide: z.string()
});
