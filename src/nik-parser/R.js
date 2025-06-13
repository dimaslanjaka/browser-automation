// get Date
/**
 * Format a date into a string using PHP-style format.
 * Supports format like 'Y-m-d', 'H:i:s', etc.
 *
 * @param {string} format - Format string (e.g. "Y-m-d H:i:s")
 * @param {Date|number|string} [inputDate] - Date object, timestamp (in seconds), or ISO string.
 * @returns {string} - Formatted date string.
 */
export function R(format, inputDate) {
  const MONTH_DAY_NAMES = [
    'Sun',
    'Mon',
    'Tues',
    'Wednes',
    'Thurs',
    'Fri',
    'Satur',
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  // Normalize the input to Date object
  const n =
    inputDate instanceof Date
      ? new Date(inputDate)
      : typeof inputDate === 'number'
        ? new Date(inputDate * 1000)
        : inputDate
          ? new Date(inputDate)
          : new Date();

  // Pad numbers with leading zeros
  const pad = (num, size) => {
    let s = String(num);
    while (s.length < size) s = '0' + s;
    return s;
  };

  const r = {
    d: () => pad(n.getDate(), 2),
    D: () => r.l().slice(0, 3),
    j: () => n.getDate(),
    l: () => `${MONTH_DAY_NAMES[n.getDay()]}day`,
    N: () => n.getDay() || 7,
    S: () => {
      const date = n.getDate();
      const j = date % 10;
      const suffix =
        j === 1 && date !== 11 ? 'st' : j === 2 && date !== 12 ? 'nd' : j === 3 && date !== 13 ? 'rd' : 'th';
      return suffix;
    },
    w: () => n.getDay(),
    z: () => {
      const start = new Date(n.getFullYear(), 0, 0);
      const diff = n - start;
      return Math.floor(diff / 86400000);
    },
    W: () => {
      const target = new Date(n.valueOf());
      const dayNr = (n.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const jan4 = new Date(target.getFullYear(), 0, 4);
      const diff = target - jan4;
      return pad(1 + Math.round(diff / 86400000 / 7), 2);
    },
    F: () => MONTH_DAY_NAMES[6 + n.getMonth()],
    m: () => pad(n.getMonth() + 1, 2),
    M: () => r.F().slice(0, 3),
    n: () => n.getMonth() + 1,
    t: () => new Date(n.getFullYear(), n.getMonth() + 1, 0).getDate(),
    L: () => {
      const y = n.getFullYear();
      return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 1 : 0;
    },
    o: () => {
      const d = new Date(n);
      d.setDate(d.getDate() - ((n.getDay() + 6) % 7) + 3);
      return d.getFullYear();
    },
    Y: () => n.getFullYear(),
    y: () => String(n.getFullYear()).slice(-2),
    a: () => (n.getHours() >= 12 ? 'pm' : 'am'),
    A: () => r.a().toUpperCase(),
    B: () => {
      const utc = n.getUTCHours() * 3600 + n.getUTCMinutes() * 60 + n.getUTCSeconds();
      return pad(Math.floor((utc + 3600) / 86.4) % 1000, 3);
    },
    g: () => n.getHours() % 12 || 12,
    G: () => n.getHours(),
    h: () => pad(r.g(), 2),
    H: () => pad(n.getHours(), 2),
    i: () => pad(n.getMinutes(), 2),
    s: () => pad(n.getSeconds(), 2),
    u: () => pad(n.getMilliseconds() * 1000, 6),
    e: () => {
      throw new Error('Not supported');
    },
    I: () => {
      const jan = new Date(n.getFullYear(), 0);
      const jul = new Date(n.getFullYear(), 6);
      return jan.getTimezoneOffset() !== jul.getTimezoneOffset() ? 1 : 0;
    },
    O: () => {
      const offset = -n.getTimezoneOffset();
      const sign = offset >= 0 ? '+' : '-';
      const abs = Math.abs(offset);
      return sign + pad(Math.floor(abs / 60) * 100 + (abs % 60), 4);
    },
    P: () => {
      const O = r.O();
      return O.substr(0, 3) + ':' + O.substr(3, 2);
    },
    T: () => 'UTC',
    Z: () => -n.getTimezoneOffset() * 60,
    c: () => R('Y-m-d\\TH:i:sP', n),
    r: () => R('D, d M Y H:i:s O', n),
    U: () => Math.floor(n.getTime() / 1000)
  };

  const tokenRegex = /\\?(.?)/gi;

  return format.replace(tokenRegex, (match, token) => {
    if (match.startsWith('\\')) return token;
    return r[token] ? r[token]() : token;
  });
}
