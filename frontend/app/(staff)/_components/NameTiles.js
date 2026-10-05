'use client';

const TONE = {
  dark: { tile: 'bg-neutral-800 text-white hover:bg-neutral-700', sub: 'text-neutral-400' },
  light: { tile: 'border border-sand-300 bg-white text-ink-900 hover:border-ocean-400', sub: 'text-ink-400' },
};

/**
 * The first step of a PIN sign-in: one large button per person. Tapping a
 * name means the PIN that follows is only ever checked against that person.
 * `people`: [{ id, name, role? }]. `subtitle(person)`: an optional small line under the name.
 */
export default function NameTiles({ people, tone = 'dark', onPick, subtitle }) {
  const look = TONE[tone];
  return (
    <ul className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
      {people.map((person) => (
        <li key={person.id}>
          <button
            type="button"
            onClick={() => onPick(person)}
            className={`flex min-h-[5rem] w-full flex-col items-center justify-center rounded-2xl px-3 py-4 text-center transition active:scale-95 ${look.tile}`}
          >
            <span className="text-xl font-bold leading-tight">{person.name}</span>
            {subtitle && <span className={`mt-1 text-xs ${look.sub}`}>{subtitle(person)}</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
