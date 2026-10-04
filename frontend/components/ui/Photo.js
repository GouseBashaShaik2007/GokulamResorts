import Image from 'next/image';

// Hosts next.config.js allows the image optimiser to fetch from. Anything else
// (an image pasted from another site, local dev storage) still shows — just as
// a plain <img>, because next/image throws for hosts it isn't configured for.
const OPTIMISABLE = [/^\//, /^https:\/\/images\.unsplash\.com\//, /^https:\/\/[a-z0-9-]+\.supabase\.co\//];

/**
 * A photo that fills its parent. The parent must be `relative` and have a
 * size (height or aspect ratio). `sizes` tells the browser how wide the photo
 * is on screen so phones don't download desktop-sized files.
 */
export default function Photo({ src, alt, sizes = '100vw', priority = false, className = '', ...rest }) {
  if (OPTIMISABLE.some((pattern) => pattern.test(src))) {
    return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} {...rest} />;
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? undefined : 'lazy'}
      decoding="async"
      className={`absolute inset-0 h-full w-full object-cover ${className}`}
      {...rest}
    />
  );
}
