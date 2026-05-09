import pc from "picocolors";

export const c = {
  red: (s: string) => pc.red(s),
  green: (s: string) => pc.green(s),
  yellow: (s: string) => pc.yellow(s),
  blue: (s: string) => pc.blue(s),
  dim: (s: string) => pc.dim(s),
  bold: (s: string) => pc.bold(s),
  cyan: (s: string) => pc.cyan(s),
};

export function info(message: string): void {
  console.log(`${c.dim("›")} ${message}`);
}

export function success(message: string): void {
  console.log(`${c.green("✔")} ${message}`);
}

export function warn(message: string): void {
  console.log(`${c.yellow("!")} ${message}`);
}

export function fail(message: string): void {
  console.error(`${c.red("✖")} ${message}`);
}
