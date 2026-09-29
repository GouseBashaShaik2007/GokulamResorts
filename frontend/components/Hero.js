import Link from 'next/link';
import Parallax from './motion/Parallax';
import OpenBookingButton from './booking/OpenBookingButton';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1920&q=80';

export default function Hero() {
  return (
    <section className="relative grid overflow-hidden bg-navy-900 lg:min-h-[92vh] lg:grid-cols-[3fr_2fr]">
      {/* Image column */}
      <div className="relative h-[55vh] lg:order-1 lg:h-full">
        <Parallax className="absolute inset-0" range={12}>
          <img src={HERO_IMAGE} alt="Chirala Beach at Gokulam Resorts" className="h-full w-full object-cover" />
        </Parallax>
        <div className="absolute inset-0 bg-hero-gradient lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-navy-900/40" />
      </div>

      {/* Copy column */}
      <div className="relative z-10 order-2 -mt-16 flex flex-col justify-center rounded-t-3xl bg-navy-900 px-6 py-14 sm:px-10 lg:mt-0 lg:rounded-none lg:px-12 lg:py-24 xl:px-16">
        <p className="eyebrow">Chirala Beach · Andhra Pradesh, India</p>
        <h1 className="display-heading mt-4">
          Gokulam
          <br />
          <span className="italic text-gold-400">Resorts</span>
        </h1>
        <p className="mt-6 max-w-md text-lg text-navy-100">
          Wake to the sound of waves and the warmth of Indian hospitality. Private beachfront rooms,
          candlelit dining, and a coastline all your own.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <OpenBookingButton className="btn-gold">Check Availability</OpenBookingButton>
          <Link href="/contact" className="btn-outline">
            Contact Us
          </Link>
        </div>
      </div>

      {/* Overlapping glass badge, sits on the image/panel seam */}
      <div className="glass absolute left-6 top-[calc(55vh-2.5rem)] z-20 rounded-2xl px-5 py-3 lg:left-[calc(60%-2.5rem)] lg:top-auto lg:bottom-16">
        <p className="eyebrow text-[0.65rem] md:text-xs">Beachfront · Chirala</p>
        <p className="mt-1 font-serif text-lg font-semibold text-navy-50">Private Beach Access</p>
      </div>
    </section>
  );
}
