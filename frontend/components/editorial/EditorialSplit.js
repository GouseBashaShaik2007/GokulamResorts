import Reveal from '../motion/Reveal';

/**
 * Asymmetric 60/40 image+content block. The content column overlaps the
 * image via a negative margin on large screens for an editorial, layered
 * feel; on mobile it stacks with a simpler pulled-up overlap.
 */
export default function EditorialSplit({
  image,
  imageAlt = '',
  imageSide = 'left',
  overlap = true,
  imageClassName = '',
  children,
}) {
  const isRight = imageSide === 'right';

  return (
    <div className="grid gap-0 lg:grid-cols-[3fr_2fr]">
      <div
        className={`relative h-72 overflow-hidden rounded-2xl lg:h-full lg:rounded-none ${
          isRight ? 'lg:order-2' : 'lg:order-1'
        }`}
      >
        <img src={image} alt={imageAlt} className={`h-full w-full object-cover ${imageClassName}`} />
      </div>

      <Reveal
        as="div"
        className={`relative z-10 -mt-8 mx-4 flex flex-col justify-center rounded-2xl border border-navy-700/60 bg-navy-900 p-8 shadow-lg shadow-black/20 sm:p-10 lg:mx-0 lg:mt-0 ${
          isRight ? 'lg:order-1' : 'lg:order-2'
        } ${overlap ? (isRight ? 'lg:-mr-20 lg:rounded-r-none' : 'lg:-ml-20 lg:rounded-l-none') : ''}`}
      >
        {children}
      </Reveal>
    </div>
  );
}
