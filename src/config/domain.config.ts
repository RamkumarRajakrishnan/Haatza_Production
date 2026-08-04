export const DOMAIN_CONFIG = {
  // Primary base domain for all requests, redirects, and navigation
  BASE_DOMAIN: process.env.BASE_DOMAIN || 'https://www.haatza.com',

  // Subdomain helper constructor
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

  get shoppingUrl(): string {
    return this.getSubdomain('shopping');
  },

  get sellerUrl(): string {
    return this.getSubdomain('seller');
  },

  get adminUrl(): string {
    return this.getSubdomain('admin');
  },

  get liteUrl(): string {
    return this.getSubdomain('lite');
  },

  get apiUrl(): string {
    return `${this.BASE_DOMAIN}/api`;
  },

  get mediaUrl(): string {
    return process.env.MEDIA_BASE_URL || `${this.BASE_DOMAIN}/uploads`;
  },

  // CORS Allowed origins helper list
  getAllowedOrigins(): string[] {
    const customOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
      : [];

    return Array.from(
      new Set([
        this.BASE_DOMAIN,
        this.shoppingUrl,
        this.sellerUrl,
        this.adminUrl,
        this.liteUrl,
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080',
        ...customOrigins,
      ]),
    );
  },
};
