import type { Request } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/prisma';
import type { LogAction, LogEntity } from '../domain/constants';

export interface ActorContext {
  actorUserId: number | null;
  actorName: string | null;
}

export function getActorFromRequest(req: Request): ActorContext {
  const actorNameHeader = req.header('x-actor-name');
  const actorIdHeader = req.header('x-actor-user-id');
  const parsedId = actorIdHeader ? Number(actorIdHeader) : NaN;

  return {
    actorUserId: Number.isInteger(parsedId) && parsedId > 0 ? parsedId : null,
    actorName: actorNameHeader?.trim() ? actorNameHeader.trim() : null,
  };
}

interface LogInput {
  actor?: ActorContext;
  entityType: LogEntity;
  action: LogAction;
  entityId?: string | null;
  message?: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return Prisma.JsonNull;
  }

  try {
    return JSON.parse(JSON.stringify(value)) as
      | object
      | string
      | number
      | boolean;
  } catch {
    return String(value);
  }
}

export async function createActivityLog(input: LogInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorUserId: input.actor?.actorUserId ?? null,
        actorName: input.actor?.actorName ?? null,
        entityType: input.entityType,
        action: input.action,
        entityId: input.entityId ?? null,
        message: input.message ?? null,
        before: toJsonValue(input.before),
        after: toJsonValue(input.after),
        metadata: toJsonValue(input.metadata),
      },
    });
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}
