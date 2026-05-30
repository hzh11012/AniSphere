import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './server.js';

type SessionEntry = {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
};

const sessions = new Map<string, SessionEntry>();

export default async function (fastify: FastifyInstance) {
  const { config } = fastify;

  const verifyToken = (auth: string | undefined): boolean => {
    if (!config.MCP_TOKEN) return true;
    return auth === `Bearer ${config.MCP_TOKEN}`;
  };

  const handle = async (
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> => {
    if (!verifyToken(request.headers.authorization)) {
      reply.status(401).send({ error: 'Unauthorized' });
      return;
    }

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    let entry = sessionId ? sessions.get(sessionId) : undefined;

    if (!entry) {
      if (sessionId) {
        reply.status(404).send({ error: 'Session not found' });
        return;
      }

      // onsessioninitialized 在 handleRequest 处理 initialize 消息时触发，
      // 此时 entry 已赋值，通过闭包读取最新值存入 sessions
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id: string) => {
          sessions.set(id, entry!);
        }
      });

      transport.onclose = () => {
        const id = transport.sessionId;
        if (id) sessions.delete(id);
      };

      const server = createMcpServer(fastify);
      await server.connect(transport);
      entry = { transport, server };
    }

    reply.hijack();
    await entry.transport.handleRequest(request.raw, reply.raw, request.body);
  };

  fastify.get('/', handle);
  fastify.post('/', handle);
  fastify.delete('/', handle);
}
