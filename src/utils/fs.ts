import { promises as fs } from 'node:fs';
import path from 'node:path';

export interface FileNode {
  name: string;
  path: string;
  hasChildren: boolean;
}

export async function readDir(
  rootDir: string,
  relativePath: string
): Promise<FileNode[]> {
  const fullPath = path.join(rootDir, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });

  const dirs = entries.filter(
    e => e.isDirectory() && !e.name.startsWith('@') && !e.name.startsWith('.')
  );
  dirs.sort((a, b) => a.name.localeCompare(b.name));

  const nodes = await Promise.all(
    dirs.map(async entry => {
      const entryRelativePath = path.join(relativePath, entry.name);
      const childPath = path.join(rootDir, entryRelativePath);
      let hasChildren = false;
      try {
        const children = await fs.readdir(childPath, { withFileTypes: true });
        hasChildren = children.some(
          c =>
            c.isDirectory() &&
            !c.name.startsWith('@') &&
            !c.name.startsWith('.')
        );
      } catch {
        // ignore
      }
      return { name: entry.name, path: entryRelativePath, hasChildren };
    })
  );

  return nodes;
}
