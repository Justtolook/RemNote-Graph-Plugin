/**
 * Standalone demo of the graph view with a synthetic knowledge base, for UI work and
 * screenshots without RemNote: `npm run demo`, then open dev/demo.html.
 */
import ReactDOM from 'react-dom';
import { GraphView } from '../src/components/GraphView';
import { buildGraph, neighborhood, type RawRem } from '../src/lib/buildGraph';
import '../src/style.css';

const topics = [
  'Machine Learning', 'Linear Algebra', 'Statistics', 'Neural Networks', 'Optimization',
  'Biology', 'Genetics', 'Evolution', 'Cell Biology', 'History', 'Roman Empire',
  'Renaissance', 'Philosophy', 'Ethics', 'Epistemology', 'Economics', 'Game Theory',
  'Microeconomics', 'Spanish Vocabulary', 'Grammar', 'Chemistry', 'Organic Chemistry',
  'Physics', 'Thermodynamics', 'Quantum Mechanics', 'Calculus', 'Probability',
  'Reading List', 'Project Ideas', 'Exam Prep',
];

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}
const rand = rng(7);
const rems: RawRem[] = [];
const docs: string[] = [];
topics.forEach((t, i) => {
  const id = `doc${i}`;
  docs.push(id);
  rems.push({ id, parent: i % 5 === 0 || i < 3 ? null : `doc${Math.floor(i / 5) * 5}`, text: [t] });
});
for (let i = 0; i < 400; i++) {
  const doc = docs[Math.floor(rand() * docs.length)];
  const group = Math.floor(docs.indexOf(doc) / 5);
  const text: unknown[] = [`Note ${i}`];
  if (rand() < 0.5) {
    const near = docs[Math.min(docs.length - 1, group * 5 + Math.floor(rand() * 5))];
    text.push(' see ', { i: 'q', _id: near });
  }
  if (rand() < 0.12) text.push(' and ', { i: 'q', _id: docs[Math.floor(rand() * docs.length)] });
  rems.push({ id: `n${i}`, parent: doc, text });
}

const params = new URLSearchParams(location.search);
if (params.get('theme') === 'dark') document.body.classList.add('dark');
const full = buildGraph(rems, {
  mode: 'documents',
  documentIds: new Set(docs),
  excludedRootIds: new Set(),
  hierarchy: true,
  references: true,
  hideOrphans: false,
});
const local = params.get('local');
const data = local ? neighborhood(full, local, 1) : full;

ReactDOM.render(
  <div className={`rg-panel ${local ? 'rg-compact' : ''}`}>
    <GraphView data={data} centerId={local ?? undefined} compact={!!local} onOpenNode={(id) => console.log('open', id)} />
  </div>,
  document.getElementById('root')
);
