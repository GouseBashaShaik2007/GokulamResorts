// Kitchen PINs anyone would try first: one digit repeated (0000, 111111) or a
// straight run up or down (1234, 123456, 4321). A 4-digit PIN is all that
// stands between the kitchen screen and the public sign-in page, so these are
// refused when a PIN is set.
function isObviousPin(pin) {
  const value = String(pin);
  if (/^(\d)\1+$/.test(value)) return true;
  return '01234567890'.includes(value) || '09876543210'.includes(value);
}

module.exports = { isObviousPin };
