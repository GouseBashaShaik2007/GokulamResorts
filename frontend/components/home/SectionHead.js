import Reveal from '@/components/motion/Reveal';

/** Eyebrow + heading for a home page section, with an optional action on the right. */
export default function SectionHead({ eyebrow, title, action }) {
  return (
    <Reveal className="mb-10 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-heading mt-1">{title}</h2>
      </div>
      {action}
    </Reveal>
  );
}
