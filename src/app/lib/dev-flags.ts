export const IS_LOCAL_DEV = process.env.NODE_ENV !== "production";

export function shouldUseDevCode() {
  return IS_LOCAL_DEV;
}

export function shouldBypassMailInLocal() {
  return IS_LOCAL_DEV;
}