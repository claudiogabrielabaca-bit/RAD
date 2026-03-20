export function normalizeUserText(value: string) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasExcessiveRepetition(text: string) {
  const lower = text.toLowerCase();
  const compact = lower.replace(/\s+/g, "");

  if (compact.length >= 6 && /(.)\1{5,}/.test(compact)) {
    return true;
  }

  if (compact.length >= 8 && /^(.{1,3})\1{3,}$/.test(compact)) {
    return true;
  }

  if (/\b([a-z0-9_]{2,})\b(?:\s+\1){3,}/i.test(lower)) {
    return true;
  }

  const alnum = compact.replace(/[^a-z0-9]/g, "");
  if (alnum.length >= 8 && new Set(alnum).size <= 2) {
    return true;
  }

  return false;
}

export function validateFeedbackText(
  value: string,
  maxLength: number,
  options?: {
    allowEmpty?: boolean;
  }
) {
  const allowEmpty = !!options?.allowEmpty;
  const text = normalizeUserText(value);

  if (!text) {
    if (allowEmpty) {
      return { ok: true as const, text: "" };
    }

    return {
      ok: false as const,
      text: "",
      error: "Text cannot be empty.",
    };
  }

  if (text.length > maxLength) {
    return {
      ok: false as const,
      text,
      error: `Text is too long (max ${maxLength} chars).`,
    };
  }

  if (hasExcessiveRepetition(text)) {
    return {
      ok: false as const,
      text,
      error: "Text looks too repetitive. Write something more meaningful.",
    };
  }

  return {
    ok: true as const,
    text,
  };
}