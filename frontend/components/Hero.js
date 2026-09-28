import Link from 'next/link';

export default function Hero() {
  return (
    <section className="relative flex min-h-[80vh] items-center overflow-hidden bg-navy-900">
      {/* Background image with a navy gradient overlay for a luxury, moody look */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage:
            "url('https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1920&q=80')",
        }}
      />
      <div className="absolute inset-0 bg-hero-gradient" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <p className="eyebrow">Chirala Beach · Andhra Pradesh, India</p>
        <h1 className="mt-4 max-w-2xl font-serif text-4xl font-bold leading-tight text-white sm:text-5xl md:text-6xl">
          Gokulam Resorts
        </h1>
        <p className="mt-6 max-w-xl text-lg text-navy-100">
          Wake to the sound of waves and the warmth of Indian hospitality. Private beachfront rooms,
          candlelit dining, and a coastline all your own.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <Link href="/rooms" className="btn-gold">
            Browse Rooms
          </Link>
          <Link href="/contact" className="btn-outline">
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
