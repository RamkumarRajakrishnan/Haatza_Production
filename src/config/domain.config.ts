export const DOMAIN_CONFIG = {
  // Primary base domain for all requests, redirects, and navigation
  BASE_DOMAIN: process.env.BASE_DOMAIN || 'https://www.haatza.com',

  // Subdomain helper constructor - prepared for future subdomains without code refactoring
  getSubdomain(subdomainName?: string): string {
    const rawDomain = this.BASE_DOMAIN.replace(/^https?:\/\//, '').replace(/^www\./, '');
    const protocol = this.BASE_DOMAIN.startsWith('http://') ? 'http://' : 'https://';

    if (!subdomainName || subdomainName === 'www' || subdomainName === 'main') {
      return `${protocol}www.${rawDomain}`;
    }
    return `${protocol}${subdomainName}.${rawDomain}`;
  },

  // Dynamic route helpers using central base domain
  get appUrl(): string {
    return this.BASE_DOMAIN;
  },

  get apiUrl(): string {
    return `${this.BASE_DOMAIN}/api`;
  },

  get mediaUrl(): string {
    return process.env.MEDIA_BASE_URL || `${this.BASE_DOMAIN}/uploads`;
  },
};
