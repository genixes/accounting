import type {CapChunk} from './kit';

// Transcript (English). Timings come from forced alignment of the supplied voice over.
const w = (s: string): {w: string; hl?: boolean}[] => s.split(' ').map((x) => (x.startsWith('*') ? {w: x.slice(1), hl: true} : {w: x}));
const c = (t0: number, t1: number, s: string): CapChunk => ({t0, t1, words: w(s)});

export const CAPTIONS: CapChunk[] = [
  c(0.06, 0.98, '*Quick *question:'),
  c(0.99, 2.99, 'Is the *court booked for *Saturday?'),
  c(3.0, 4.62, 'Hold on, let me check the *notebook.'),
  c(4.7, 6.45, 'And of course, the notebook is *missing.'),
  c(6.47, 7.67, 'Does that sound *familiar?'),
  c(7.69, 8.64, "You're not *alone."),
  c(8.66, 10.88, 'A lot of businesses still run on *paper,'),
  c(10.9, 11.72, '*group *chats,'),
  c(11.73, 12.65, 'and a *spreadsheet'),
  c(12.66, 14.53, 'that only *one *person understands.'),
  c(14.54, 15.7, 'It gets *exhausting.'),
  c(15.71, 17.46, "That's why we built *LAYAW *System."),
  c(17.48, 19.55, 'We make software for *real *businesses:'),
  c(19.58, 21.52, 'a *POS for your *café,'),
  c(21.54, 23.77, '*online *booking for *courts and *rentals,'),
  c(23.78, 25.62, '*project *management for *construction,'),
  c(25.65, 28.64, 'and a *PDF *editor for all your documents.'),
  c(28.65, 30.06, 'Doing things a little *differently?'),
  c(30.08, 30.77, "That's *fine."),
  c(30.79, 32.0, 'Just tell us *how *you *work,'),
  c(32.0, 33.64, "and we'll *build a *system around you."),
];
