import React from 'react';
import { Helmet } from 'react-helmet-async';
import { APP_CONFIG } from '@/lib/constants';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  noIndex?: boolean;
  canonical?: string;
  children?: React.ReactNode;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  title,
  description = APP_CONFIG.description,
  keywords = [],
  // FD-10: /og-image.jpg does not exist in public/. Defaulting to the external social image
  // already declared in index.html. A proper 1200×630 og-image.jpg needs a design/Lovable handoff.
  image = 'https://storage.googleapis.com/gpt-engineer-file-uploads/v7VNKr4nPzWrw1UkoJhuK24gaky2/social-images/social-1768627311442-EQ-exotiq-white-lockup-white.svg',
  url,
  type = 'website',
  noIndex = false,
  canonical,
  children,
}) => {
  const fullTitle = title ? `${title} | ${APP_CONFIG.name}` : APP_CONFIG.name;
  const fullUrl = url ? `${APP_CONFIG.websiteUrl}${url}` : APP_CONFIG.websiteUrl;
  const fullImage = image.startsWith('http') ? image : `${APP_CONFIG.websiteUrl}${image}`;

  const defaultKeywords = [
    'fleet management',
    'AI fleet optimization',
    'luxury car rental',
    'vehicle analytics',
    'fleet profitability',
    'booking management',
    'compliance tracking',
    'Exotiq.ai'
  ];

  const allKeywords = [...defaultKeywords, ...keywords].join(', ');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={allKeywords} />
      <meta name="author" content={APP_CONFIG.author} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      
      {/* SEO Meta Tags */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {canonical && <link rel="canonical" href={canonical} />}
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={APP_CONFIG.name} />
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />
      
      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#3b82f6" />
      <meta name="msapplication-TileColor" content="#3b82f6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={APP_CONFIG.name} />
      
      {/* Preconnect to external domains */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          "name": APP_CONFIG.name,
          "description": description,
          "url": fullUrl,
          "applicationCategory": "BusinessApplication",
          "operatingSystem": "Web Browser",
          "offers": {
            "@type": "Offer",
            "category": "SaaS"
          },
          "author": {
            "@type": "Organization",
            "name": APP_CONFIG.author,
            "url": APP_CONFIG.websiteUrl
          }
        })}
      </script>

      {children}
    </Helmet>
  );
};