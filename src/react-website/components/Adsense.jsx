import { useEffect, useRef } from 'react';

/**
 * AdSense React component for rendering various Google AdSense ad formats.
 *
 * Props:
 * @param {string} client - AdSense client ID (e.g., "ca-pub-xxxxxxxxxxxxxxxx")
 * @param {string} slot - AdSense ad slot ID
 * @param {object} [style={ display: 'block' }] - Inline style for the <ins> element
 * @param {string} [format='auto'] - Ad format (e.g., 'auto', 'fluid', 'autorelaxed')
 * @param {string} [layout] - Ad layout (e.g., 'in-article')
 * @param {boolean} [fullWidthResponsive] - Enables data-full-width-responsive="true" for responsive ads
 *
 * Usage examples:
 *
 * // In-article ad:
 * <AdSense client="ca-pub-1048456668116270" slot="8640099506" style={{ display: 'block', textAlign: 'center' }} layout="in-article" format="fluid" />
 *
 * // Responsive ad:
 * <AdSense client="ca-pub-1165447249910969" slot="3325057139" style={{ display: 'block' }} format="auto" fullWidthResponsive />
 *
 * // Multiplex (autorelaxed) ad:
 * <AdSense client="ca-pub-1165447249910969" slot="8307991972" style={{ display: 'block' }} format="autorelaxed" />
 */
function AdSense({ client, slot, style = { display: 'block' }, format = 'auto', layout, fullWidthResponsive }) {
  const adRef = useRef(null);

  useEffect(() => {
    // @ts-ignore
    if (window.adsbygoogle && adRef.current) {
      try {
        // @ts-ignore
        window.adsbygoogle.push({});
      } catch {
        // AdSense script may not be loaded yet
      }
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={style}
      data-ad-client={client}
      data-ad-slot={slot}
      data-ad-format={format}
      {...(layout ? { 'data-ad-layout': layout } : {})}
      {...(fullWidthResponsive ? { 'data-full-width-responsive': 'true' } : {})}
      ref={adRef}
    />
  );
}

export default AdSense;
