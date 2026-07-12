import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(serverDir, '..', '..');

for (const envPath of [
  path.join(workspaceRoot, '.env.local'),
  path.join(workspaceRoot, '.env'),
  path.join(workspaceRoot, 'frontend', '.env.local'),
  path.join(workspaceRoot, 'frontend', '.env'),
]) {
  dotenv.config({ path: envPath, override: false, quiet: true });
}
