const HEADING = {
  display: 'display-heading mt-2 text-4xl md:text-5xl',
  compact: 'display-heading mt-1 text-3xl',
  section: 'section-heading mt-1',
};

/**
 * The top of a page: the small line above, the page's one <h1>, and whatever
 * introduces it (`children`).
 *
 * `size`: 'display' is the large heading on guest pages; 'compact' the same
 * style at phone-screen size, for the ordering screens; 'section' the quieter
 * one used on staff screens.
 */
export default function PageHeader({ eyebrow, title, size = 'display', className = '', children }) {
  return (
    <div className={className}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className={HEADING[size]}>{title}</h1>
      {children}
    </div>
  );
}
