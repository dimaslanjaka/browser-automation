import React from 'react';
import timezones from './components/timezones.json';
import moment from 'moment-timezone';
import Header from './components/Header';
import Footer from './components/Footer';
import styles from './Date.module.scss';
import HighlightElement from './components/HighlightElement';

export function FullTimezoneList() {
  React.useEffect(() => {
    const table = document.getElementById('table-timezones');

    if (table) {
      const theadInner = timezones
        .flatMap((timezone) => {
          return Object.keys(timezone);
        })
        .filter(function (elem, index, self) {
          return index === self.indexOf(elem);
        })
        .map((str) => `<th>${str}</th>`)
        .join('');

      table.querySelector('thead').innerHTML = `<tr>${theadInner}<th>Current Time</th><th>Moment.js Code</th></tr>`;

      const tbodyInner = timezones
        .map((timezone) => {
          const zones = timezone.utc || [];
          if (zones.length === 0) {
            return `<tr><td>${timezone.value}</td><td>${timezone.abbr}</td><td>${timezone.offset}</td><td>${timezone.isdst}</td><td>${timezone.text}</td><td></td><td></td><td></td></tr>`;
          }
          return zones
            .map((zone, idx) => {
              const baseCols =
                idx === 0
                  ? `<td rowspan="${zones.length}">${timezone.value}</td><td rowspan="${zones.length}">${timezone.abbr}</td><td rowspan="${zones.length}">${timezone.offset}</td><td rowspan="${zones.length}">${timezone.isdst}</td><td rowspan="${zones.length}">${timezone.text}</td>`
                  : '';
              return `<tr>${baseCols}<td>${zone}</td><td><span timezone="${zone}">${moment().tz(zone).format()}</span></td><td><pre class="codeblock"><code code="${zone}" class="language-typescript">moment().tz("${zone}").format()</code></pre></td></tr>`;
            })
            .join('');
        })
        .join('');

      table.querySelector('tbody').innerHTML = tbodyInner;
    }
  });
  return (
    <section className="mx-auto p-2">
      <h2>World-wide timezone</h2>
      <p>
        all timezone format for <kbd>moment-timezone</kbd>. But, you need import <kbd>moment-timezone</kbd>
      </p>
      <HighlightElement lang="typescript">
        {`import moment from 'moment-timezone'; // const moment = require('moment-timezone');`}
      </HighlightElement>
      <div className="table-responsive">
        <table className={`table ${styles.table}`} id="table-timezones">
          <thead></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>
  );
}

export function FullTimezoneListPage() {
  return (
    <>
      <Header />
      <div className="container">
        <h1>Full Timezone List</h1>
        <p>This page lists all available timezones with their details.</p>
        <FullTimezoneList />
      </div>
      <Footer />
    </>
  );
}
