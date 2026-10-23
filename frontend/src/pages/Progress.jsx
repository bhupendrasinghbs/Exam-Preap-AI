import { Link } from 'react-router-dom';
import { ListChecks, BarChart3, Trophy, FileText, CheckSquare } from 'lucide-react';
import { load, avgScore, fmtDate } from '../utils/storage.js';
import { Stat, PageHeader, Empty } from '../components/ui.jsx';

export default function Progress() {
  const quizzes = load('quizzes'), notes = load('notes'), tasks = load('plan', null)?.tasks || [];
  if (!quizzes.length && !notes.length && !tasks.length) return <div><PageHeader title="Progress" sub="Your learning stats." /><div className="card"><Empty text="Nothing to show yet. Generate notes or take a quiz first."><Link to="/notes" className="btn-primary">Get started</Link></Empty></div></div>;
  const best = quizzes.length ? Math.max(...quizzes.map((q) => Math.round((q.score / q.total) * 100))) : 0;
  const rate = tasks.length ? Math.round((tasks.filter((t) => t.done).length / tasks.length) * 100) : 0;
  const weak = {};
  quizzes.forEach((q) => { if (q.wrong?.length) weak[q.topic] = (weak[q.topic] || 0) + q.wrong.length; });
  const weakList = Object.entries(weak).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <div className="space-y-6">
      <PageHeader title="Progress" sub="Calculated from your saved activity." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={ListChecks} label="Quizzes attempted" value={quizzes.length} /><Stat icon={BarChart3} label="Average score" value={quizzes.length ? `${avgScore(quizzes)}%` : '–'} /><Stat icon={Trophy} label="Best score" value={quizzes.length ? `${best}%` : '–'} />
        <Stat icon={FileText} label="Notes saved" value={notes.length} /><Stat icon={CheckSquare} label="Plan completion" value={tasks.length ? `${rate}%` : '–'} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card"><h2 className="mb-3 font-semibold">Recent quizzes</h2>{quizzes.length ? <ul className="space-y-3 text-sm">{quizzes.slice(0, 6).map((q) => { const p = Math.round((q.score / q.total) * 100); return <li key={q.id}><div className="mb-1 flex justify-between"><span>{q.topic} <span className="text-slate-400">· {q.difficulty} · {fmtDate(q.date)}</span></span><span className="font-medium">{q.score}/{q.total}</span></div><div className="h-1.5 rounded bg-slate-100"><div className="h-1.5 rounded bg-indigo-600" style={{ width: `${p}%` }} /></div></li>; })}</ul> : <Empty text="No quizzes yet." />}</div>
        <div className="card"><h2 className="mb-3 font-semibold">Topics to revise</h2>{weakList.length ? <ul className="space-y-2 text-sm">{weakList.map(([t, n]) => <li key={t} className="flex justify-between"><span>{t}</span><span className="text-amber-700">{n} missed</span></li>)}</ul> : <Empty text="Nothing flagged. Missed quiz questions will show up here." />}</div>
      </div>
    </div>
  );
}
