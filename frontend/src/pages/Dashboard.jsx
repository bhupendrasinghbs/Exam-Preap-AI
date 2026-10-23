import { Link } from 'react-router-dom';
import { ListChecks, BarChart3, FileText, CheckSquare, Upload, Sparkles } from 'lucide-react';
import { load, avgScore, fmtDate } from '../utils/storage.js';
import { Stat, PageHeader, Empty } from '../components/ui.jsx';

export default function Dashboard() {
  const quizzes = load('quizzes'), notes = load('notes'), plan = load('plan', null);
  const tasks = plan?.tasks || [];
  const upcoming = tasks.filter((t) => !t.done).slice(0, 5);
  const activity = [...notes.map((n) => ({ t: `Saved notes: ${n.title}`, d: n.date })), ...quizzes.map((q) => ({ t: `Quiz "${q.topic}": ${q.score}/${q.total}`, d: q.date }))].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 5);
  return (
    <div className="space-y-6">
      <PageHeader title="Welcome back 👋" sub="Here's where your preparation stands." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={ListChecks} label="Quizzes attempted" value={quizzes.length} />
        <Stat icon={BarChart3} label="Average score" value={quizzes.length ? `${avgScore(quizzes)}%` : '–'} />
        <Stat icon={FileText} label="Notes saved" value={notes.length} />
        <Stat icon={CheckSquare} label="Tasks completed" value={`${tasks.filter((t) => t.done).length}/${tasks.length}`} />
      </div>
      <div className="flex flex-wrap gap-3"><Link to="/notes" className="btn-primary"><Upload className="h-4 w-4" />Upload study material</Link><Link to="/quiz" className="btn-ghost"><Sparkles className="h-4 w-4" />Generate a quiz</Link></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card"><h2 className="mb-3 font-semibold">Recent activity</h2>{activity.length ? <ul className="space-y-2 text-sm">{activity.map((a, i) => <li key={i} className="flex justify-between gap-2"><span>{a.t}</span><span className="text-slate-400">{fmtDate(a.d)}</span></li>)}</ul> : <Empty text="No activity yet." />}</div>
        <div className="card"><h2 className="mb-3 font-semibold">Upcoming study tasks</h2>{upcoming.length ? <ul className="space-y-2 text-sm">{upcoming.map((t) => <li key={t.id} className="flex justify-between gap-2"><span><b>{t.topic}</b>: {t.task}</span><span className="text-slate-400">{fmtDate(t.date)}</span></li>)}</ul> : <Empty text="No pending tasks."><Link to="/planner" className="btn-ghost">Create a plan</Link></Empty>}</div>
      </div>
    </div>
  );
}
