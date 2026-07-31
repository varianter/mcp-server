import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { McpServerConfigFileSchema } from '../dist/config/config.js';

const schema = z.toJSONSchema(McpServerConfigFileSchema);
schema.$id = 'https://github.com/varianter/mcp-server/mcp-server.config.schema.json';
schema.title = 'mcp-server.config.json';
schema.description =
  'Committed defaults for @variant/mcp-server runtime config. Env vars override these at startup.';

const outPath = fileURLToPath(new URL('../mcp-server.config.schema.json', import.meta.url));
writeFileSync(outPath, `${JSON.stringify(schema, null, 2)}\n`);
console.log(`wrote ${outPath}`);
