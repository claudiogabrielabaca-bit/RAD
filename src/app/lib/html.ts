import { decode } from "he";

export function decodeHtml(value?: string | null) {
  if (!value) return "";
  return decode(value).trim();
}