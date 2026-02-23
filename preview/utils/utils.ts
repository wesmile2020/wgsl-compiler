export function camelCaseIdentifier(name: string): string {
  let output: string = '';
  for (let i = 0; i < name.length; i += 1) {
    if (i === 0) {
      output += name[i].toUpperCase();
    } else if (name[i] === '_') {
      output += '';
    } else if (name[i - 1] === '_') {
      output += name[i].toUpperCase();
    } else {
      output += name[i].toLowerCase();
    }
  }
  return output;
}
