import { Type } from '@sinclair/typebox';

export const PluginsQueryStringSchema = Type.Object({
  type: Type.Optional(
    Type.String({
      enum: ['installed', 'all']
    })
  ),
  force: Type.Optional(Type.Boolean())
});

export const PluginSchema = Type.Object({
  pluginId: Type.String()
});

export const PluginConfigSchema = Type.Object({
  config: Type.Any()
});
