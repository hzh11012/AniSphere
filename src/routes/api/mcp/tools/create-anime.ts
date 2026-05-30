import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

export function registerCreateAnime(
  server: McpServer,
  fastify: FastifyInstance
) {
  const { seriesRepository, animeRepository } = fastify;

  server.registerTool(
    'create_anime',
    {
      description:
        '将动漫信息录入 Qnya 数据库。系列不存在时自动创建，入库 status 默认为 draft。',
      inputSchema: {
        seriesName: z.string().describe('系列名称，如《进击的巨人》'),
        name: z.string().describe('本季番剧名称'),
        description: z.string().optional().default('暂无简介'),
        remark: z
          .string()
          .optional()
          .describe(
            '番剧一句话简评，严格不超过15字。风格犀利有趣，可借用当下流行网络梗、二次元黑话或谐音梗，让人看一眼就想点进去。禁止填"暂无"或平铺直叙的剧情描述。'
          ),
        cover: z.string().optional().default('').describe('封面图 URL'),
        banner: z.string().optional().default('').describe('横幅图 URL'),
        status: z
          .enum(['draft', 'upcoming', 'airing', 'completed'])
          .optional()
          .default('draft'),
        type: z.enum(['movie', 'japanese', 'american', 'chinese', 'adult']),
        year: z.number().describe('上映年份'),
        month: z.enum(['january', 'april', 'july', 'october']),
        season: z.number().optional().default(1).describe('季数，默认 1'),
        seasonName: z.string().optional().describe('季名称，可选'),
        director: z.string().optional().default('未知').describe('导演'),
        cv: z.string().optional().default('未知').describe('声优列表'),
        tagIds: z
          .array(z.number())
          .optional()
          .default([])
          .describe('从 list_tags 返回的标签 ID 列表，挑选符合题材的填入')
      }
    },
    async ({
      seriesName,
      name,
      description,
      remark,
      cover,
      banner,
      status,
      type,
      year,
      month,
      season,
      seasonName,
      director,
      cv,
      tagIds
    }) => {
      const seriesResult = await seriesRepository.findByName(seriesName);
      if (seriesResult.isErr())
        return {
          content: [{ type: 'text', text: '查找系列失败' }],
          isError: true
        };

      let seriesId: number;
      if (seriesResult.value) {
        seriesId = seriesResult.value.id;
      } else {
        const created = await seriesRepository.create({ name: seriesName });
        if (created.isErr())
          return {
            content: [{ type: 'text', text: '创建系列失败' }],
            isError: true
          };
        seriesId = created.value.id;
      }

      const s = season ?? 1;
      const existing = await animeRepository.findBySeriesAndSeason(seriesId, s);
      if (existing.isErr())
        return { content: [{ type: 'text', text: '查重失败' }], isError: true };
      if (existing.value)
        return {
          content: [
            { type: 'text', text: `《${name}》第 ${s} 季已存在，无需重复入库` }
          ],
          isError: true
        };

      const result = await animeRepository.create({
        seriesId,
        season: s,
        seasonName,
        name,
        description: description ?? '暂无简介',
        remark: (remark ?? '暂无').slice(0, 25),
        cover: cover ?? '',
        banner: banner ?? '',
        status: status ?? 'draft',
        type,
        year,
        month,
        director: director ?? '未知',
        cv: cv ?? '未知',
        tags: tagIds ?? []
      });

      if (result.isErr())
        return {
          content: [
            { type: 'text', text: `入库失败: ${result.error.message}` }
          ],
          isError: true
        };

      return {
        content: [
          {
            type: 'text',
            text: `✅ 《${name}》第 ${s} 季已入库，状态: ${status ?? 'draft'}，系列: ${seriesName}`
          }
        ]
      };
    }
  );
}
