// Search-engine data (JSON-LD) is written into a <script> tag as raw text.
// Some of it comes from the database — room names, descriptions, amenities —
// so a "<" in that text (for example "</script>") must not be able to close
// the tag and start markup of its own. Escaped, it is still the same JSON.
export const jsonLd = (data) => JSON.stringify(data).replace(/</g, '\\u003c');
