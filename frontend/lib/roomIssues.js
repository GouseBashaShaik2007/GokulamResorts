// Problems housekeeping can report from a room. The values are the ones the
// API accepts; keep in step with KINDS in
// backend/src/controllers/roomIssue.controller.js.
export const ISSUE_KINDS = [
  { value: 'repair', label: 'Something is broken' },
  { value: 'damage', label: 'Damage or a stain' },
  { value: 'lost_property', label: 'A guest left something' },
  { value: 'other', label: 'Something else' },
];

export const ISSUE_KIND_LABEL = Object.fromEntries(ISSUE_KINDS.map((k) => [k.value, k.label]));
