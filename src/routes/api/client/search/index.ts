import type { FastifyInstance } from 'fastify';
import { SuccessResponseSchema } from '../../../../schemas/common.js';
import {
  SearchSuggestQuerySchema,
  SearchSuggestResponseSchema,
  type SearchSuggestQuery
} from '../../../../schemas/search.js';
import { highlight } from '../../../../utils/pinyin.js';
import { t2s } from '../../../../utils/t2s.js';

const CJK_RE = /\p{Script=Han}/u;

export default async function (fastify: FastifyInstance) {
  const { animeRepository, log, authenticate } = fastify;

  fastify.get<{ Querystring: SearchSuggestQuery }>(
    '/suggestions',
    {
      schema: {
        querystring: SearchSuggestQuerySchema,
        response: {
          200: SuccessResponseSchema(SearchSuggestResponseSchema)
        }
      }
    },
    async (request, reply) => {
      await authenticate(request, reply);

      const { keyword } = request.query;
      const isAdmin = request.sessionData?.role === 'admin';
      const excludeTypes = isAdmin ? undefined : ['adult'];

      const result = await animeRepository.findByNameLike(
        keyword,
        excludeTypes
      );
      if (result.isErr()) {
        log.error({ error: result.error }, 'Failed to get search suggestions');
        return reply.internalServerError('获取搜索建议失败');
      }

      const isChinese = CJK_RE.test(keyword);
      const kw = keyword.toLowerCase();

      const data = result.value.map(a => {
        let highlightName: string;
        if (a.matchedByName) {
          highlightName = isChinese
            ? highlight(a.name, t2s(keyword))
            : `<em class="keyword">${a.name}</em>`;
        } else {
          const matchesPinyin =
            a.namePinyin?.includes(kw) || a.nameInitials?.includes(kw);
          highlightName = matchesPinyin
            ? `<em class="keyword">${a.name}</em>`
            : a.name;
        }
        return { name: a.name, highlightName };
      });

      return reply.success('获取搜索建议成功', data);
    }
  );
}
