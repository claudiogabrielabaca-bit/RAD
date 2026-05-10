type ScriptSafetyOptions = {
  scriptName: string;
  operation: string;
  allowDryRunBypass?: boolean;
};

function getArgs() {
  return process.argv.slice(2);
}

export function hasScriptFlag(flag: string) {
  const normalizedFlag = flag.startsWith("--") ? flag : `--${flag}`;

  return getArgs().some((arg) => arg === normalizedFlag);
}

export function getScriptValueFlag(flag: string) {
  const normalizedFlag = flag.startsWith("--") ? flag.slice(2) : flag;
  const prefix = `--${normalizedFlag}=`;

  const match = getArgs().find((arg) => arg.startsWith(prefix));

  return match ? match.slice(prefix.length) : null;
}

export function getFirstPositionalArg() {
  return getArgs().find((arg) => !arg.startsWith("--")) ?? null;
}

function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "";
}

function isProbablyProductionDatabase() {
  const databaseUrl = getDatabaseUrl().toLowerCase();

  return (
    process.env.NODE_ENV === "production" ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RAILWAY_PROJECT_ID ||
    !!process.env.RAILWAY_SERVICE_ID ||
    databaseUrl.includes("railway") ||
    databaseUrl.includes("rlwy") ||
    databaseUrl.includes("proxy.rlwy.net")
  );
}

export function requireScriptSafety(options: ScriptSafetyOptions) {
  const isDryRun = hasScriptFlag("dryRun");
  const confirmed = hasScriptFlag("confirm");
  const allowedProduction = hasScriptFlag("allowProduction");
  const productionLike = isProbablyProductionDatabase();

  if (options.allowDryRunBypass !== false && isDryRun) {
    return;
  }

  if (!confirmed) {
    throw new Error(
      [
        `[${options.scriptName}] Refusing to run without --confirm.`,
        "",
        `Operation: ${options.operation}`,
        "",
        "Run again with:",
        `  --confirm`,
        "",
        productionLike
          ? "This also looks like a production/Railway database, so you will also need --allowProduction."
          : "If this is production/Railway, also pass --allowProduction intentionally.",
      ].join("\n")
    );
  }

  if (productionLike && !allowedProduction) {
    throw new Error(
      [
        `[${options.scriptName}] Refusing to run against a production-like database without --allowProduction.`,
        "",
        `Operation: ${options.operation}`,
        "",
        "Run again only if you really intend this:",
        `  --confirm --allowProduction`,
      ].join("\n")
    );
  }
}