import { Type } from '@sinclair/typebox';

export const HealthResponseSchema = Type.Object({
  status: Type.String(),
  timestamp: Type.Number(),
  uptime: Type.Number(),
  environment: Type.String(),
  database: Type.Object({
    status: Type.String(),
    latency: Type.Optional(Type.Number())
  }),
  redis: Type.Object({
    status: Type.String(),
    latency: Type.Optional(Type.Number())
  })
});
