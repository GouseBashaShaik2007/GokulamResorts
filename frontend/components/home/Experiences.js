import Link from 'next/link';
import Photo from '@/components/ui/Photo';
import { RevealStagger, RevealStaggerItem } from '@/components/motion/RevealStagger';
import { EXPERIENCES } from '@/lib/site';
import SectionHead from './SectionHead';

// A tile that leads somewhere zooms on hover; one that doesn't stays still, so
// it never looks like a link it isn't.
function Tile({ href, children }) {
  const frame = 'relative block aspect-[3/4] overflow-hidden rounded-2xl';
  return href ? <Link href={href} className={`media-zoom group ${frame}`}>{children}</Link> : <div className={frame}>{children}</div>;
}

export default function Experiences() {
  return (
    <section className="bg-navy-900 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Experiences" title="Days by the sea" />
        <RevealStagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {EXPERIENCES.map((x) => (
            <RevealStaggerItem key={x.title}>
              <Tile href={x.href}>
                <Photo src={x.image} alt="" data-placeholder="true" sizes="(min-width: 1024px) 25vw, 50vw" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden="true" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-serif text-2xl font-semibold text-white">{x.title}</h3>
                  <p className="mt-1 text-sm text-white/80">{x.text}</p>
                </div>
              </Tile>
            </RevealStaggerItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
