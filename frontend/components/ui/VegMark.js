/** The green (vegetarian) or red (non-vegetarian) dot-in-a-square used on Indian menus. */
export default function VegMark({ veg, className = '' }) {
  return (
    <span
      className={`inline-flex h-5 w-5 flex-none items-center justify-center rounded-sm border-2 bg-white ${veg ? 'border-green-600' : 'border-red-600'} ${className}`}
      title={veg ? 'Vegetarian' : 'Non-vegetarian'}
      role="img"
      aria-label={veg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span className={`h-2 w-2 rounded-full ${veg ? 'bg-green-600' : 'bg-red-600'}`} />
    </span>
  );
}
