import { defineTool, Type } from "./pi-stub";
import { VaultAdapter } from "./VaultAdapter";
import { IS_MOBILE } from "./mobile";

export class ToolRegistry {
  private tools: Map<string, ReturnType<typeof defineTool>> = new Map();

  constructor(private vaultAdapter: VaultAdapter) {}

  /**
   * Register a tool by name. Overwrites if already exists.
   * D-10 pattern: register(name, handler)
   */
  register(
    name: string,
    handler: ReturnType<typeof defineTool>
  ): void {
    this.tools.set(name, handler);
  }

  /**
   * Unregister a tool by name. No-op if not found.
   * D-10 pattern: unregister(name)
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Get all registered tools as an array.
   * Used by agent session creation.
   */
  getTools(): Array<ReturnType<typeof defineTool>> {
    return Array.from(this.tools.values());
  }

  /**
   * Check if a tool is registered.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Register all Obsidian-native tools, replacing pi SDK defaults.
   * TOOL-01: Replaces bash, read, write, edit with vault_*
   * TOOL-02: Additional tools: vault_search, metadata_query, get_backlinks, get_orphans, vault_rename, list_files, http_request
   * TOOL-03: bash/git desktop-only; MOBI-01 silent exclusion on mobile
   */
  registerDefaultTools(): void {
    // CRITICAL: Clear any existing tools first
    this.tools.clear();

    // Always-registered tools (10)
    this.registerVaultReadTool();
    this.registerVaultWriteTool();
    this.registerVaultEditTool();
    this.registerVaultSearchTool();
    this.registerMetadataQueryTool();
    this.registerGetBacklinksTool();
    this.registerGetOrphansTool();
    this.registerVaultRenameTool();
    this.registerListFilesTool();
    this.registerHttpRequestTool();

    // Desktop-only tools (2) - MOBI-01: silent absence on mobile
    if (!IS_MOBILE) {
      this.registerBashTool();
      this.registerGitLogTool();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // TOOL IMPLEMENTATIONS
  // ═══════════════════════════════════════════════════════════════

  private registerVaultReadTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('vault_read', defineTool({
      name: 'vault_read',
      label: 'Vault Read',
      description: 'Read the content of an Obsidian note. Use this to read any note in your vault. Returns the full markdown content.',
      parameters: Type.Object({
        path: Type.String({ description: 'The path of the note to read, relative to vault root (e.g., "work/project-alpha/notes/intro.md")' })
      }),
      async execute(_toolCallId, { path }) {
        const content = await vaultAdapter.readNote(path);
        return {
          content: [{ type: 'text', text: content }],
          details: { path }
        };
      }
    }));
  }

  private registerVaultWriteTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('vault_write', defineTool({
      name: 'vault_write',
      label: 'Vault Write',
      description: 'Create a new note or overwrite an existing note with the given content. Use for creating new notes or completely replacing content.',
      parameters: Type.Object({
        path: Type.String({ description: 'The path of the note to write, relative to vault root' }),
        content: Type.String({ description: 'The markdown content to write to the note' })
      }),
      async execute(_toolCallId, { path, content }) {
        await vaultAdapter.writeNote(path, content);
        return {
          content: [{ type: 'text', text: `Note written to ${path}` }],
          details: { path }
        };
      }
    }));
  }

  private registerVaultEditTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('vault_edit', defineTool({
      name: 'vault_edit',
      label: 'Vault Edit',
      description: 'Edit an existing note by applying a transformation function. The function receives the current content and returns the new content. Use for atomic edits like finding/replacing, adding sections, or updating frontmatter.',
      parameters: Type.Object({
        path: Type.String({ description: 'The path of the note to edit' }),
        fn: Type.String({ description: 'JavaScript code as string that transforms content. Use a function expression like: (content) => content.replace(/old/g, "new")' })
      }),
      async execute(_toolCallId, { path, fn }) {
        // SECURITY: The fn parameter is executed in context of vaultAdapter.editNote
        // This is intentionally limited - agent provides transformation code
        const transformFn = new Function('content', `return (${fn})(content)`) as (content: string) => string;
        await vaultAdapter.editNote(path, transformFn);
        return {
          content: [{ type: 'text', text: `Note edited: ${path}` }],
          details: { path }
        };
      }
    }));
  }

  private registerVaultSearchTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('vault_search', defineTool({
      name: 'vault_search',
      label: 'Vault Search',
      description: 'Search for notes by filename (not content). Returns a list of matching note paths. For content search, use vault_read on suspected files.',
      parameters: Type.Object({
        query: Type.String({ description: 'The search query to match against note filenames' })
      }),
      async execute(_toolCallId, { query }) {
        const results = vaultAdapter.searchByFilename(query);
        const paths = results.map(f => f.path).join('\n');
        return {
          content: [{ type: 'text', text: paths || 'No matching notes found.' }],
          details: { query, count: results.length }
        };
      }
    }));
  }

  private registerMetadataQueryTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('metadata_query', defineTool({
      name: 'metadata_query',
      label: 'Metadata Query',
      description: 'Get metadata for a note including frontmatter, tags, links, and backlinks. Does not return content.',
      parameters: Type.Object({
        path: Type.String({ description: 'The path of the note to get metadata for' })
      }),
      async execute(_toolCallId, { path }) {
        const metadata = vaultAdapter.getMetadata(path);
        if (!metadata) {
          return {
            content: [{ type: 'text', text: `Could not get metadata for ${path}` }],
            details: { path, found: false }
          };
        }
        const frontmatter = metadata.frontmatter ? JSON.stringify(metadata.frontmatter, null, 2) : 'null';
        const text = [
          `Path: ${metadata.path}`,
          `Frontmatter: ${frontmatter}`,
          `Tags: ${metadata.tags.join(', ') || '(none)'}`,
          `Links: ${metadata.links.length}`,
          `Outlinks: ${metadata.outlinks.length}`,
          `Backlinks: ${metadata.backlinks.length}`
        ].join('\n');
        return {
          content: [{ type: 'text', text }],
          details: { path, found: true }
        };
      }
    }));
  }

  private registerGetBacklinksTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('get_backlinks', defineTool({
      name: 'get_backlinks',
      label: 'Get Backlinks',
      description: 'Get all notes that link to a specific note (backlinks). Shows what other notes reference this note.',
      parameters: Type.Object({
        path: Type.String({ description: 'The path of the note to get backlinks for' })
      }),
      async execute(_toolCallId, { path }) {
        const backlinks = vaultAdapter.getBacklinksForFile(path);
        if (backlinks.length === 0) {
          return {
            content: [{ type: 'text', text: `No backlinks found for ${path}` }],
            details: { path, count: 0 }
          };
        }
        const lines = backlinks.map(bl => `- [[${bl.link}]]`).join('\n');
        return {
          content: [{ type: 'text', text: `Backlinks for ${path}:\n${lines}` }],
          details: { path, count: backlinks.length }
        };
      }
    }));
  }

  private registerGetOrphansTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('get_orphans', defineTool({
      name: 'get_orphans',
      label: 'Get Orphan Notes',
      description: 'Find notes that have no backlinks from other notes. Orphan notes may need linking or cleanup.',
      parameters: Type.Object({}),
      async execute(_toolCallId, {}) {
        const allFiles = vaultAdapter.listFiles('md');
        const orphans: string[] = [];
        for (const file of allFiles) {
          const backlinks = vaultAdapter.getBacklinksForFile(file.path);
          if (backlinks.length === 0) {
            orphans.push(file.path);
          }
        }
        if (orphans.length === 0) {
          return {
            content: [{ type: 'text', text: 'No orphan notes found.' }],
            details: { count: 0 }
          };
        }
        return {
          content: [{ type: 'text', text: `Orphan notes:\n${orphans.join('\n')}` }],
          details: { count: orphans.length }
        };
      }
    }));
  }

  private registerVaultRenameTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('vault_rename', defineTool({
      name: 'vault_rename',
      label: 'Vault Rename',
      description: 'Rename a note. Note: This does NOT update wikilinks in other files (VAULT-04 in Phase 2 will handle that).',
      parameters: Type.Object({
        oldPath: Type.String({ description: 'The current path of the note' }),
        newPath: Type.String({ description: 'The new path for the note' })
      }),
      async execute(_toolCallId, { oldPath, newPath }) {
        const result = await vaultAdapter.renameNote(oldPath, newPath);
        return {
          content: [{ type: 'text', text: `Renamed to ${result}` }],
          details: { oldPath, newPath }
        };
      }
    }));
  }

  private registerListFilesTool(): void {
    const vaultAdapter = this.vaultAdapter;
    this.register('list_files', defineTool({
      name: 'list_files',
      label: 'List Files',
      description: 'List all notes in the vault, optionally filtered by path prefix.',
      parameters: Type.Object({
        path: Type.Optional(Type.String({ description: 'Optional path prefix to filter by (e.g., "work/")' }))
      }),
      async execute(_toolCallId, { path }) {
        let files = vaultAdapter.listFiles('md');
        if (path) {
          files = files.filter(f => f.path.startsWith(path));
        }
        const paths = files.map(f => f.path).join('\n');
        return {
          content: [{ type: 'text', text: paths || 'No notes found.' }],
          details: { count: files.length, filter: path ?? null }
        };
      }
    }));
  }

  private registerHttpRequestTool(): void {
    this.register('http_request', defineTool({
      name: 'http_request',
      label: 'HTTP Request',
      description: 'Make an HTTP request to fetch content from a URL. Use for fetching web pages, APIs, or external resources.',
      parameters: Type.Object({
        url: Type.String({ description: 'The URL to fetch' }),
        method: Type.Optional(Type.String({ description: 'HTTP method: GET, POST, PUT, DELETE. Default: GET' })),
        headers: Type.Optional(Type.Record(Type.String(), Type.String(), { description: 'HTTP headers as key-value pairs' })),
        body: Type.Optional(Type.String({ description: 'Request body for POST/PUT' }))
      }),
      async execute(_toolCallId, { url, method = 'GET', headers, body }) {
        // Note: In actual Obsidian plugin, we'd use app.requestUrl() which is safer
        // For now, use global fetch (available in Electron renderer)
        try {
          const response = await fetch(url, { method, headers, body });
          const text = await response.text();
          return {
            content: [{ type: 'text', text: text.slice(0, 10000) }], // Limit response size
            details: { url, status: response.status as number | undefined, size: text.length as number | undefined, error: undefined as string | undefined }
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `HTTP request failed: ${error}` }],
            details: { url, status: undefined as number | undefined, size: undefined as number | undefined, error: String(error) as string | undefined }
          };
        }
      }
    }));
  }

  // ═══════════════════════════════════════════════════════════════
  // DESKTOP-ONLY TOOLS (MOBI-01: silent absence on mobile)
  // ═══════════════════════════════════════════════════════════════

  private registerBashTool(): void {
    this.register('bash', defineTool({
      name: 'bash',
      label: 'Bash',
      description: '[Desktop only] Execute a shell command. DO NOT use for Obsidian vault operations - use vault_read/vault_write instead.',
      parameters: Type.Object({
        command: Type.String({ description: 'The shell command to execute' }),
        cwd: Type.Optional(Type.String({ description: 'Working directory for the command' }))
      }),
      async execute(_toolCallId, { command, cwd }) {
        // TOOL-03: child_process desktop-only
        // Note: In Obsidian Electron renderer, child_process is available
        // This tool is desktop-only per MOBI-01
        return new Promise((resolve) => {
          const { exec } = require('child_process');
          exec(command, { cwd }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              resolve({
                content: [{ type: 'text', text: `Error: ${error.message}\n${stderr}` }],
                details: { exitCode: 1 }
              });
            } else {
              resolve({
                content: [{ type: 'text', text: stdout || '(no output)' }],
                details: { exitCode: 0 }
              });
            }
          });
        });
      }
    }));
  }

  private registerGitLogTool(): void {
    this.register('git_log', defineTool({
      name: 'git_log',
      label: 'Git Log',
      description: '[Desktop only] Get the git commit history for a repository. Useful for tracking recent changes.',
      parameters: Type.Object({
        repo: Type.Optional(Type.String({ description: 'Path to the git repository. Defaults to vault root.' })),
        limit: Type.Optional(Type.Number({ description: 'Maximum number of commits to return. Default: 20' }))
      }),
      async execute(_toolCallId, { repo, limit = 20 }) {
        // TOOL-03: git via child_process desktop-only
        return new Promise((resolve) => {
          const { exec } = require('child_process');
          const cwd = repo || '.';
          exec(`git log --oneline -n ${limit}`, { cwd }, (error: Error | null, stdout: string, stderr: string) => {
            if (error) {
              resolve({
                content: [{ type: 'text', text: `Git error: ${error.message}` }],
                details: { exitCode: 1 }
              });
            } else {
              resolve({
                content: [{ type: 'text', text: stdout || '(no commits)' }],
                details: { exitCode: 0 }
              });
            }
          });
        });
      }
    }));
  }
}
