import { Platform } from 'obsidian';

/**
 * Platform detection at module load time.
 * D-07: Used to gate desktop-only features (bash, git) on mobile.
 * MOBI-01: bash/Git tools NOT registered on mobile (silent degradation).
 */
export const IS_MOBILE: boolean = Platform.isMobile;

/**
 * Desktop-only feature flag for conditional tool registration.
 */
export const IS_DESKTOP: boolean = !IS_MOBILE;
