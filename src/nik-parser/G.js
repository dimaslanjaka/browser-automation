// get Time
export function G(...e) {
  const t = new Date(),
    n = e;
  const s = ['Hours', 'Minutes', 'Seconds', 'Month', 'Date', 'FullYear'];

  for (let r = 0; r < s.length; r++) {
    if (n[r] === undefined) {
      n[r] = t[`get${s[r]}`]();
      if (r === 3) n[r] += 1; // Month (0-based)
    } else {
      n[r] = parseInt(n[r], 10);
      if (isNaN(n[r])) return false;
    }
  }

  if (n[5] >= 0) {
    if (n[5] <= 69) n[5] += 2000;
    else if (n[5] <= 100) n[5] += 1900;
  }

  t.setFullYear(n[5], n[3] - 1, n[4]); // month is 0-based
  t.setHours(n[0], n[1], n[2]);

  const timestamp = (t.getTime() / 1000) >> 0;
  return timestamp - (t.getTime() < 0 ? 1 : 0);
}
