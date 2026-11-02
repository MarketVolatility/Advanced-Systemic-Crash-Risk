/** Check structural invariants (array bounds, required nodes); never fill missing market data. */
export function requiredValue<T>(value:T|null|undefined):T {
  if(value===null||value===undefined)throw new Error('Required value is missing.');
  return value;
}
