import { useEffect, useRef } from 'react';

const AdSense = ({ client, slot, style = { display: 'block' }, format = 'auto' }) => {
  const adRef = useRef(null);

  useEffect(() => {
    // @ts-ignore
    if (window.adsbygoogle && adRef.current) {
      try {
        // @ts-ignore
        window.adsbygoogle.push({});
      } catch (e) {
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
      ref={adRef}
    />
  );
};

export default AdSense;