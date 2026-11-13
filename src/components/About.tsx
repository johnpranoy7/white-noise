const SECTIONS: { title: string; body: string }[] = [
  {
    title: 'What the colors mean',
    body:
      'A noise color describes how its energy spreads across pitch. White noise is equal at every frequency. ' +
      'Pink and brown roll off the highs, so they sound softer and deeper. Blue leans toward the highs, ' +
      'green sits in the midrange, and grey is shaped to sound equally loud at every pitch.',
  },
  {
    title: 'Made live, never looped',
    body:
      'Every sound is calculated in your browser as it plays, so there is no recording to repeat and ' +
      'no seam to notice. Nothing is downloaded while you listen, and it works offline once loaded.',
  },
  {
    title: 'Nature sounds',
    body:
      'Rain, stream, ocean and breeze are tuned to be soft and slow: no sharp drops, no whistling wind, ' +
      'and waves that roll in about every twelve seconds.',
  },
  {
    title: 'Timers',
    body:
      'The sleep timer fades out gently over its last stretch instead of stopping abruptly. The focus ' +
      'timer runs work and break blocks and lowers the sound during breaks.',
  },
  {
    title: 'Listening comfortably',
    body:
      'Keep the volume just loud enough to soften distractions. For babies and young children, place ' +
      'the speaker across the room, keep it quiet, and use the sleep timer rather than playing all night.',
  },
];

export function About() {
  return (
    <section className="about" aria-labelledby="about-title">
      <h2 id="about-title">About the sounds</h2>
      <div className="about-grid">
        {SECTIONS.map((s) => (
          <article key={s.title}>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
