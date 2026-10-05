// Tab titles on the staff screens. Each starts with the screen's own name and
// ends the same way ("Kitchen — Gokulam staff"), so several open tabs can be
// told apart at a glance.
export const STAFF_TITLE = '%s — Gokulam staff';

/**
 * The `title` for a layout that names a screen with pages of its own beneath
 * it (Kitchen → Kitchen sign-in). A plain string here would drop the ending
 * from those pages: a layout's title replaces the pattern handed down to it.
 */
export const screenTitle = (name) => ({ default: name, template: STAFF_TITLE });
