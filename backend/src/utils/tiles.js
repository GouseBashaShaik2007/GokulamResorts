// The names on a sign-in screen's tiles. That screen can be opened by anyone,
// so a tile shows as little as tells colleagues apart: the first name, and the
// initial of the surname only when two people share a first name.
//
// A title counts as part of the first name, so "Chef Ravi" stays "Chef Ravi"
// rather than every cook becoming "Chef".
const TITLE = /^(chef|mr|mrs|ms|miss|dr|sri|shri|smt)\.?$/i;

function parts(name) {
  const words = String(name).trim().split(/\s+/);
  const titled = words.length > 1 && TITLE.test(words[0]);
  return { first: words.slice(0, titled ? 2 : 1).join(' '), rest: words.slice(titled ? 2 : 1) };
}

function tileNames(people) {
  const shared = new Map();
  for (const person of people) {
    const key = parts(person.name).first.toLowerCase();
    shared.set(key, (shared.get(key) || 0) + 1);
  }

  return people.map((person) => {
    const { first, rest } = parts(person.name);
    const clash = shared.get(first.toLowerCase()) > 1 && rest.length > 0;
    return { ...person, name: clash ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first };
  });
}

module.exports = { tileNames };
