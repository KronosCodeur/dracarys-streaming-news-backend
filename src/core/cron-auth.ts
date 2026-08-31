import type { Request } from "express";
import { env } from "../config/env";

export function isCronAuthorized(req: Request): boolean {
  return Boolean(env.cronSecret) && req.headers.authorization === `Bearer ${env.cronSecret}`;
}
