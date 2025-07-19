import React, { useEffect, useState } from 'react';
import AdSense from './components/Adsense';
import { decodeSafelinkQueryParameter } from './components/utils.cjs';

const Outbound = () => {
  const [outboundUrl, setOutboundUrl] = useState(null);

  useEffect(() => {
    decodeSafelinkQueryParameter()
      .then((url) => {
        if (url) {
          setOutboundUrl(url);
        } else {
          console.warn('No outbound URL found in the query or hash.');
        }
      })
      .catch((error) => {
        console.error('Error decoding Safelink query parameter:', error);
      });
  }, []);

  return (
    <div style={{ padding: 32, textAlign: 'center' }}>
      <h2>Redirecting...</h2>
      <AdSense
        client="ca-pub-2188063137129806"
        slot="5634823028"
        style={{ display: 'block', textAlign: 'center' }}
        layout="in-article"
        format="fluid"
      />
      {outboundUrl ? (
        <>
          <p>
            You are being redirected to{' '}
            <a id="go" href={outboundUrl} rel="noopener noreferrer" target="_blank">
              {outboundUrl}
            </a>
          </p>
          <p>
            If you are not redirected automatically, <a href={outboundUrl}>click here</a>.
          </p>
        </>
      ) : (
        <p>No outbound URL found in the query or hash.</p>
      )}
    </div>
  );
};

export default Outbound;
