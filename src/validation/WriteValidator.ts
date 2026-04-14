/**
 * WriteValidator - async non-blocking write validation for VAULT-03.
 *
 * Validates notes after vault_write tool calls:
 * - Frontmatter completeness: date, description (~150 chars), tags
 * - Wikilink presence for notes over 300 chars (ROUTE-04)
 *
 * Non-blocking: uses setTimeout(0) to run after agent response completes.
 * Surfacing: Obsidian Notice for async non-blocking feedback.
 */

import { VaultAdapter } from '../VaultAdapter';
import { Notice } from 'obsidian';

export interface ValidationResult {
  valid: boolean;
  issues: string[];
}

export class WriteValidator {
  private vaultAdapter: VaultAdapter;

  constructor(vaultAdapter: VaultAdapter) {
    this.vaultAdapter = vaultAdapter;
  }

  /**
   * Validate a note's frontmatter and wikilinks.
   * VAULT-03: Required fields are date, description (~150 chars), tags.
   * ROUTE-04: Notes over 300 chars must include at least one wikilink.
   *
   * @param path - Path of the note to validate
   * @returns ValidationResult with valid flag and list of issues
   */
  async validateNote(path: string): Promise<ValidationResult> {
    const issues: string[] = [];

    // Get metadata (fast, uses metadataCache)
    const metadata = this.vaultAdapter.getMetadata(path);
    if (!metadata) {
      return { valid: false, issues: ['Note not found'] };
    }

    // VAULT-03 / D-06: Check required frontmatter fields
    const frontmatter = metadata.frontmatter || {};

    if (!frontmatter.date) {
      issues.push('Missing: date');
    }

    if (!frontmatter.description) {
      issues.push('Missing: description');
    } else if (typeof frontmatter.description === 'string' && frontmatter.description.length < 100) {
      issues.push('description too short (should be ~150 chars)');
    }

    if (!frontmatter.tags || (Array.isArray(frontmatter.tags) && frontmatter.tags.length === 0)) {
      issues.push('Missing: tags');
    }

    // ROUTE-04: Wikilink check for long notes
    try {
      const content = await this.vaultAdapter.readNote(path);
      if (content.length > 300 && metadata.links.length === 0 && metadata.outlinks.length === 0) {
        issues.push('Notes over 300 chars should include wikilinks');
      }
    } catch {
      // Content read failed, skip wikilink check
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Validate a note and surface results via Notice.
   * Non-blocking: schedules validation after current execution context.
   * Use this as the post-agent hook for vault_write tool calls.
   */
  validateNoteNonBlocking(path: string): void {
    // setTimeout(0) ensures validation runs after agent response completes
    setTimeout(async () => {
      const result = await this.validateNote(path);
      if (!result.valid) {
        const msg = `Note "${path}" needs attention:\n${result.issues.join(', ')}`;
        new Notice(msg, 5000); // 5 second display
        console.warn('[WriteValidator]', msg);
      }
    }, 0);
  }
}
