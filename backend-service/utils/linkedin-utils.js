// LinkedIn URL utilities
// Shared functions for normalizing and canonicalizing LinkedIn profile URLs

/**
 * Canonicalize LinkedIn profile URL to standard format
 * @param {string} rawUrl - Raw LinkedIn URL
 * @returns {string|null} Canonicalized URL in format: https://www.linkedin.com/in/{slug}/
 */
function canonicalizeLinkedInProfile(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const input = rawUrl.trim();
  if (!input) return null;
  
  const ensureScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);
  
  try {
    const parsed = new URL(ensureScheme(input));
    const host = parsed.hostname.toLowerCase();
    if (!host.endsWith('linkedin.com')) return null;
    
    // Extract slug from /in/{slug}
    const match = parsed.pathname.match(/\/in\/([A-Za-z0-9_-]+)/i);
    if (!match) return null;
    
    const slug = match[1].toLowerCase();
    return `https://www.linkedin.com/in/${slug}/`;
  } catch {
    return null;
  }
}

/**
 * Build LinkedIn URL variants for robust matching
 * Handles trailing slashes, www vs non-www, http vs https, etc.
 * @param {string} rawUrl - Raw LinkedIn URL
 * @returns {string[]} Array of URL variants
 */
function buildLinkedInUrlVariants(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return [];

  const candidates = new Set();

  const trimmed = rawUrl.trim();
  const lower = trimmed.toLowerCase();
  candidates.add(lower);

  // Toggle trailing slash variants
  if (lower.endsWith('/')) {
    candidates.add(lower.replace(/\/+$/, ''));
  } else {
    candidates.add(`${lower}/`);
  }

  // Ensure scheme for URL parsing
  const ensureScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

  try {
    const urlWithScheme = ensureScheme(lower);
    const parsed = new URL(urlWithScheme);
    
    // Normalize host to include or exclude www
    const hostNoWww = parsed.host.replace(/^www\./, '');
    const hostWithWww = hostNoWww.startsWith('www.') ? hostNoWww : `www.${hostNoWww}`;

    // Drop query and hash, keep pathname only
    const pathname = parsed.pathname.replace(/\/+$/, '');

    const httpsBase = `https://${hostNoWww}${pathname}`;
    const httpsBaseWww = `https://${hostWithWww}${pathname}`;

    [httpsBase, `${httpsBase}/`, httpsBaseWww, `${httpsBaseWww}/`].forEach(v => candidates.add(v));

    // Also include host+path without scheme variants
    const noScheme = `${hostNoWww}${pathname}`;
    const noSchemeWww = `${hostWithWww}${pathname}`;
    [noScheme, `${noScheme}/`, noSchemeWww, `${noSchemeWww}/`].forEach(v => candidates.add(v));
  } catch (e) {
    // Ignore parsing errors, we still have basic variants
  }

  return Array.from(candidates);
}

module.exports = {
  canonicalizeLinkedInProfile,
  buildLinkedInUrlVariants
};

