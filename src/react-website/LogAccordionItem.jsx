import { Accordion, Table } from 'react-bootstrap';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { decryptJson } from '../utils/json-crypto.js';
import copyToClipboard from '../utils/copyToClipboard.js';
import { ucwords } from '../utils/string.js';
import styles from './LogsViewer.module.scss';

export default function LogAccordionItem({ log, idx, imageUrl }) {
  let indicatorCLass = '';
  if (log.data?.status === 'invalid') {
    indicatorCLass = styles.textInvalid;
  } else if (log.data?.status === 'success') {
    indicatorCLass = styles.textSuccess;
  } else {
    indicatorCLass = styles.textError;
  }
  return (
    <Accordion.Item eventKey={String(idx)} className={styles.accordionItem}>
      <Accordion.Header className={styles.accordionHeader}>
        <span className="d-block w-100">
          <span className={`fw-bold ${indicatorCLass}`}>{log.data?.nik || ''}</span> -{' '}
          {
            // On mobile, trim nama to fit smaller screens
            (() => {
              const nama = ucwords(log.data?.nama || '');
              if (typeof window !== 'undefined') {
                if (window.innerWidth <= 350 && nama.length > 12) {
                  return nama.slice(0, 12).trim() + '…';
                } else if (window.innerWidth <= 400 && nama.length > 15) {
                  return nama.slice(0, 15).trim() + '…';
                } else if (window.innerWidth <= 600 && nama.length > 19) {
                  return nama.slice(0, 19).trim() + '…';
                }
              }
              return nama;
            })()
          }
        </span>
      </Accordion.Header>
      <Accordion.Body className={styles.accordionBody}>
        {/* Screenshot image if available */}
        {imageUrl && <ImageBlock imageUrl={imageUrl} nik={log.data?.nik} />}
        {/* NIK with copy button */}
        <div className={`d-flex align-items-center mb-2 ${styles.nikRow}`}>
          <span className="fw-bold me-2">NIK:</span>
          <span>{log.data?.nik || ''}</span>
          {log.data?.nik && (
            <button
              className="btn btn-sm btn-copy"
              title="Copy NIK"
              onClick={() => {
                copyToClipboard(log.data.nik);
              }}>
              <i className="fa fa-copy" aria-hidden="true"></i>
            </button>
          )}
        </div>
        <div className={`${styles.logTimestamp} mb-2`}>Timestamp: {log.timestamp || ''}</div>
        <div className={`${styles.logMessage} mb-2 ${indicatorCLass}`}>{log.message || log.data?.message || ''}</div>
        <span className={styles.sectionTitle}>Basic Data</span>
        <Table bordered striped className={`mb-3 ${styles.table}`}>
          <tbody>
            <tr>
              <th>Tanggal Input</th>
              <td>
                {log.data?.tanggal || ''}
                {log.data?.tanggal && (
                  <button
                    className="btn btn-sm btn-copy"
                    title="Copy Tanggal"
                    onClick={() => copyToClipboard(log.data.tanggal)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Nama</th>
              <td>
                {ucwords(log.data?.nama || '')}
                {log.data?.nama && (
                  <button
                    className="btn btn-sm btn-copy"
                    title="Copy Nama"
                    onClick={() => copyToClipboard(log.data.nama)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Tanggal Lahir</th>
              <td>
                {log.data?.tgl_lahir || ''}
                {log.data?.tgl_lahir && (
                  <button
                    className="btn btn-sm btn-copy"
                    title="Copy Tgl Lahir"
                    onClick={() => copyToClipboard(log.data.tgl_lahir)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Alamat</th>
              <td>
                {log.data?.alamat || ''}
                {log.data?.alamat && (
                  <button
                    className="btn btn-sm btn-copy"
                    title="Copy Alamat"
                    onClick={() => copyToClipboard(log.data.alamat)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>BB</th>
              <td>
                {log.data?.bb || ''}
                {log.data?.bb && (
                  <button className="btn btn-sm btn-copy" title="Copy BB" onClick={() => copyToClipboard(log.data.bb)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>TB</th>
              <td>
                {log.data?.tb || ''}
                {log.data?.tb && (
                  <button className="btn btn-sm btn-copy" title="Copy TB" onClick={() => copyToClipboard(log.data.tb)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
            <tr>
              <th>Petugas</th>
              <td>{log.data?.petugas || ''}</td>
            </tr>
            <tr>
              <th>Status</th>
              <td>{log.data?.status || ''}</td>
            </tr>
            <tr>
              <th>Gender</th>
              <td>{log.data?.gender || ''}</td>
            </tr>
            <tr>
              <th>Umur</th>
              <td>{log.data?.age !== undefined && log.data?.age !== null ? `${log.data.age} Tahun` : ''}</td>
            </tr>
            <tr>
              <th>Pekerjaan</th>
              <td>
                {log.data?.pekerjaan || ''}
                {log.data?.pekerjaan && (
                  <button
                    className="btn-copy"
                    title="Copy Pekerjaan"
                    onClick={() => copyToClipboard(log.data.pekerjaan)}>
                    <i className="fa fa-copy" aria-hidden="true"></i>
                  </button>
                )}
              </td>
            </tr>
          </tbody>
        </Table>
        {log.data?.parsed_nik && (
          <>
            <span className="section-title">Parsed NIK</span>
            <Table bordered hover className="mb-3 parsed-nik-table">
              <tbody>
                <tr>
                  <th>Status</th>
                  <td>{log.data.parsed_nik.status || ''}</td>
                </tr>
                <tr>
                  <th>Message</th>
                  <td>{log.data.parsed_nik.message || ''}</td>
                </tr>
                {log.data.parsed_nik.data && (
                  <>
                    <tr>
                      <th>NIK</th>
                      <td>{log.data.parsed_nik.data.nik || ''}</td>
                    </tr>
                    <tr>
                      <th>Kelamin</th>
                      <td>{(log.data.parsed_nik.data.kelamin || '') === 'P' ? 'Perempuan' : 'Laki-laki'}</td>
                    </tr>
                    <tr>
                      <th>Lahir</th>
                      <td>{log.data.parsed_nik.data.lahir || ''}</td>
                    </tr>
                    <tr>
                      <th>Provinsi</th>
                      <td>{log.data.parsed_nik.data.provinsi || ''}</td>
                    </tr>
                    <tr>
                      <th>Kota/Kab</th>
                      <td>{log.data.parsed_nik.data.kotakab || ''}</td>
                    </tr>
                    <tr>
                      <th>Kecamatan</th>
                      <td>{log.data.parsed_nik.data.namaKec || ''}</td>
                    </tr>
                    <tr>
                      <th>Uniqcode</th>
                      <td>{log.data.parsed_nik.data.uniqcode || ''}</td>
                    </tr>
                    <tr>
                      <th>Original Lahir</th>
                      <td>{log.data.parsed_nik.data.originalLahir || ''}</td>
                    </tr>
                    <tr>
                      <th>Kelurahan</th>
                      <td>
                        {Array.isArray(log.data.parsed_nik.data.kelurahan) ? (
                          <ul className="list-group list-group-flush">
                            {log.data.parsed_nik.data.kelurahan.map((kel, i) =>
                              kel && typeof kel === 'object' && kel.name ? (
                                <li className="list-group-item" key={i}>
                                  {kel.name}{' '}
                                  <span className="text-muted">
                                    (ID: {kel.id}, District: {kel.district_id})
                                  </span>
                                </li>
                              ) : null
                            )}
                          </ul>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </Table>
          </>
        )}
        {log.data?.formValues && (
          <>
            <span className="section-title">Form Values</span>
            <Table bordered size="sm" className="mb-3">
              <thead>
                <tr>
                  <th>Label</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {log.data.formValues.map((field, i) => (
                  <tr key={i}>
                    <td>{field.label || ''}</td>
                    <td>{field.value || '<empty>'}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </>
        )}
      </Accordion.Body>
    </Accordion.Item>
  );
}

function ImageBlock({ imageUrl, nik }) {
  const [src, setSrc] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!imageUrl) return;
      try {
        // if it's a .bin file, fetch and decrypt it to get the data URI
        if (typeof imageUrl === 'string' && imageUrl.endsWith('.bin')) {
          try {
            const res = await axios.get(imageUrl, { responseType: 'text' });
            const uri = decryptJson(res.data, import.meta.env.VITE_JSON_SECRET);
            if (!cancelled) setSrc(uri);
          } catch (err) {
            // per instruction: on error don't display, just log
            console.error('Failed to fetch/decrypt image bin for', nik, err);
          }
        } else {
          if (!cancelled) setSrc(imageUrl);
        }
      } catch (err) {
        console.error('Failed to load image for', nik, err);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [imageUrl, nik]);

  if (!src) return null;
  return (
    <div className="mb-3 text-center">
      <div>
        <img
          src={src}
          alt={`Screenshot for NIK ${nik}`}
          loading="lazy"
          style={{
            maxWidth: '100%',
            maxHeight: 240,
            borderRadius: 8,
            boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
            margin: '0.5em 0',
            background: '#f8f9fa',
            border: '1px solid #eee'
          }}
        />
      </div>
    </div>
  );
}
