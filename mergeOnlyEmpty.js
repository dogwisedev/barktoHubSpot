// lib/mergeOnlyEmpty.js
// Given a deal's CURRENT properties and a set of NEW candidate values,
// returns only the fields that should actually be written: ones that are
// currently empty/missing on the deal AND have a non-empty new value.
// This guarantees we never overwrite existing good data with blanks (or
// with anything at all, if the field is already filled in).

function isEmpty(value) {
  return value === undefined || value === null || value === "";
}

function mergeOnlyEmpty(currentProps, newProps) {
  const toWrite = {};
  for (const [key, newValue] of Object.entries(newProps)) {
    if (isEmpty(newValue)) continue; // nothing new to offer
    if (!isEmpty(currentProps?.[key])) continue; // already has a value — don't touch it
    toWrite[key] = newValue;
  }
  return toWrite;
}

module.exports = { mergeOnlyEmpty, isEmpty };
