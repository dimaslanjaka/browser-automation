import React from 'react';
import timezones from './components/timezones.json';
import moment from 'moment-timezone';
import Header from './components/Header';
import Footer from './components/Footer';
import styles from './Date.module.scss';
import HighlightElement from './components/HighlightElement';

export function FullTimezoneList() {
  // Get all unique keys from timezones for table headers
  const headers = React.useMemo(() => {
    const keys = timezones
      .flatMap((timezone) => Object.keys(timezone))
      .filter((elem, index, self) => index === self.indexOf(elem));
    return [...keys, 'Current Time', 'Moment.js Code'];
  }, []);

  // Build table body rows
  const rows = React.useMemo(() => {
    return timezones.flatMap((timezone) => {
      const zones = timezone.utc || [];
      if (zones.length === 0) {
        return [
          <tr key={timezone.value + '-nozone'}>
            <td>{timezone.value}</td>
            <td>{timezone.abbr}</td>
            <td>{timezone.offset}</td>
            <td>{timezone.isdst}</td>
            <td>{timezone.text}</td>
            <td></td>
            <td></td>
            <td></td>
          </tr>
        ];
      }
      return zones.map((zone, idx) => (
        <tr key={timezone.value + '-' + zone}>
          {idx === 0 && (
            <>
              <td rowSpan={zones.length}>{timezone.value}</td>
              <td rowSpan={zones.length}>{timezone.abbr}</td>
              <td rowSpan={zones.length}>{timezone.offset}</td>
              <td rowSpan={zones.length}>{`${timezone.isdst}`}</td>
              <td rowSpan={zones.length}>{timezone.text}</td>
            </>
          )}
          <td>{zone}</td>
          <td>
            <span data-timezone={zone}>{moment().tz(zone).format()}</span>
          </td>
          <td>
            <HighlightElement lang="typescript">{`moment().tz("${zone}").format()`}</HighlightElement>
          </td>
        </tr>
      ));
    });
  }, []);

  return (
    <section className="mx-auto p-2">
      <h2>
        <i className="fal fa-globe" aria-hidden="true" style={{ marginRight: '1em' }}></i>
        World-wide timezone
      </h2>
      <p>
        all timezone format for <kbd>moment-timezone</kbd>. But, you need import <kbd>moment-timezone</kbd>
      </p>
      <HighlightElement lang="typescript">
        {`import moment from 'moment-timezone'; // const moment = require('moment-timezone');`}
      </HighlightElement>
      <div className="table-responsive">
        <table className={`table ${styles.table}`} id="table-timezones">
          <thead>
            <tr>
              {headers.map((header) => {
                if (header === 'Current Time') {
                  return (
                    <th key={header}>
                      <i className="fal fa-clock" aria-hidden="true" style={{ marginRight: '0.5em' }}></i>
                      {header}
                    </th>
                  );
                }
                if (header === 'Moment.js Code') {
                  return (
                    <th key={header}>
                      <i className="fal fa-code" aria-hidden="true" style={{ marginRight: '0.5em' }}></i>
                      {header}
                    </th>
                  );
                }
                if (header === 'value') {
                  return (
                    <th key={header}>
                      <i className="fal fa-globe-asia" aria-hidden="true" style={{ marginRight: '0.5em' }}></i>
                      {header}
                    </th>
                  );
                }
                return <th key={header}>{header}</th>;
              })}
            </tr>
          </thead>
          <tbody>{rows}</tbody>
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
