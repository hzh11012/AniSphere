import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';

export function registerListTags(server: McpServer, fastify: FastifyInstance) {
  const { tagsRepository } = fastify;

  server.registerTool(
    'list_tags',
    {
      description:
        '查询 Qnya 数据库中所有可用的标签（id + name），入库前先调用此工具，从中挑选符合动漫题材的标签 ID',
      inputSchema: {}
    },
    async () => {
      const result = await tagsRepository.findAllOptions();
      if (result.isErr())
        return { content: [{ type: 'text', text: '查询失败' }], isError: true };
      return {
        content: [{ type: 'text', text: JSON.stringify(result.value, null, 2) }]
      };
    }
  );
}
