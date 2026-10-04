// A pill that is either on or off: filters, category pickers, small tab sets.
// One definition, so every such control looks and reads the same.

const TONES = {
  // The site's usual "selected" colour, on an outlined pill.
  ocean: { on: 'border-ocean-500 bg-ocean-500 text-white', off: 'border-navy-700 text-navy-200 hover:border-ocean-300' },
  // Vegetarian / Jain filters, matching the green veg mark.
  green: { on: 'border-green-700 bg-green-700 text-white', off: 'border-navy-700 text-navy-200 hover:border-green-700' },
  // Filled pills (gallery categories, staff board filters).
  solid: { on: 'border-ocean-500 bg-ocean-500 text-white', off: 'border-transparent bg-navy-800 text-navy-200 hover:bg-navy-700' },
};

const SIZES = { xs: 'px-3 py-1 text-xs', sm: 'px-3.5 py-1.5 text-sm', md: 'px-4 py-2 text-sm' };

/**
 * `pressed`: whether it is on (announced to screen readers).
 * `tone`: 'ocean' | 'green' | 'solid'. `size`: 'xs' | 'sm' | 'md'.
 */
export default function Chip({ pressed, onClick, tone = 'ocean', size = 'md', className = '', children }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`flex items-center gap-2 whitespace-nowrap rounded-full border font-medium transition-colors ${SIZES[size]} ${TONES[tone][pressed ? 'on' : 'off']} ${className}`}
    >
      {children}
    </button>
  );
}
