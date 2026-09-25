import type { ClassValue } from "cn";

export { cn } from "cn";

export function join(...classes: ClassValue[]) {
  return classes.filter(Boolean).join(" ");
}
