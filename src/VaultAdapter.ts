import { App, TFile, TFolder, CachedMetadata, normalizePath } from 'obsidian';

export interface NoteMetadata {
  path: string;
  frontmatter: Record<string, any> | null;
  links: Array<{ link: string; displayText: string }>;
  outlinks: Array<{ link: string; displayText: string }>;
  backlinks: Array<{ link: string; displayText: string }>;
  tags: string[];
}

export class VaultAdapter {
  constructor(private app: App) {}

  private normalizePath(path: string): string {
    return normalizePath(path);
  }

  private getFile(path: string): TFile {
    const file = this.app.vault.getAbstractFileByPath(this.normalizePath(path));
    if (!file) throw new Error(`File not found: ${path}`);
    if (!(file instanceof TFile)) throw new Error(`Not a file: ${path}`);
    return file;
  }

  async readNote(path: string): Promise<string> {
    const file = this.getFile(path);
    return await this.app.vault.cachedRead(file);
  }

  async writeNote(path: string, content: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const file = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(normalizedPath, content);
    }
  }

  async editNote(path: string, fn: (content: string) => string): Promise<void> {
    const file = this.getFile(path);
    await this.app.vault.process(file, fn);
  }

  getMetadata(path: string): NoteMetadata | null {
    const file = this.getFile(path);
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return null;
    return {
      path: file.path,
      frontmatter: cache.frontmatter ?? null,
      links: (cache.links ?? []).map(l => ({ link: l.link, displayText: l.displayText ?? l.link })),
      outlinks: (cache.links ?? []).map(l => ({ link: l.link, displayText: l.displayText ?? l.link })),
      backlinks: this.getBacklinksForFile(file.path),
      tags: (cache.tags ?? []).map(t => t.tag)
    };
  }

  listFiles(extension?: string): TFile[] {
    const files = this.app.vault.getFiles();
    if (extension) {
      return files.filter(f => f.extension === extension);
    }
    return files;
  }

  getBacklinksForFile(path: string): Array<{ link: string; displayText: string }> {
    const resolvedLinks = this.app.metadataCache.resolvedLinks ?? {};
    const backlinks: Array<{ link: string; displayText: string }> = [];
    const normalizedPath = this.normalizePath(path);
    for (const [sourcePath, links] of Object.entries(resolvedLinks)) {
      for (const [target, count] of Object.entries(links)) {
        if (target === normalizedPath) {
          backlinks.push({ link: sourcePath, displayText: sourcePath });
        }
      }
    }
    return backlinks;
  }

  searchByFilename(query: string): TFile[] {
    const files = this.listFiles('md');
    const lowerQuery = query.toLowerCase();
    return files.filter(f => f.name.toLowerCase().includes(lowerQuery));
  }

  async renameNote(oldPath: string, newPath: string): Promise<string> {
    const file = this.getFile(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);
    await this.app.vault.rename(file, normalizedNewPath);
    return normalizedNewPath;
  }

  async createFolder(path: string): Promise<void> {
    const normalizedPath = this.normalizePath(path);
    const existing = this.app.vault.getAbstractFileByPath(normalizedPath);
    if (existing instanceof TFolder) return;
    await this.app.vault.createFolder(normalizedPath);
  }

  exists(path: string): boolean {
    const file = this.app.vault.getAbstractFileByPath(this.normalizePath(path));
    return file !== null;
  }
}
