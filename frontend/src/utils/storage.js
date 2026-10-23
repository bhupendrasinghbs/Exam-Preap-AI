const read = (k, d) => { try { return JSON.parse(localStorage.getItem('ep_' + k)) ?? d; } catch { return d; } };
export const load = (k, d = []) => read(k, d);
export const save = (k, v) => localStorage.setItem('ep_' + k, JSON.stringify(v));
export const prepend = (k, item) => { const a = load(k); a.unshift(item); save(k, a); return a; };
export const fmtDate = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const avgScore = (q) => (q.length ? Math.round(q.reduce((s, x) => s + (x.score / x.total) * 100, 0) / q.length) : 0);
