export function getAnonLabel(anonId: string) {
  if (!anonId || anonId.trim().length === 0) {
    return "Anonymous";
  }

  let hash = 0;

  for (let i = 0; i < anonId.length; i++) {
    hash = (hash * 31 + anonId.charCodeAt(i)) >>> 0;
  }

  const letter = String.fromCharCode(65 + (hash % 26));
  const number = (Math.floor(hash / 26) % 90) + 10;

  return `Anonymous ${letter}${number}`;
}