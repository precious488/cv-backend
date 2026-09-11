import {
  subscribeToEvents,
  logger,
  BaseEvent,
  UserFlaggedPayload,
} from '@craft/shared'
import { User } from '../models/User'

export async function startSecurityEventConsumer(): Promise<void> {
  await subscribeToEvents(
    'auth-service-security-queue',
    ['user.flagged'],
    async (event: BaseEvent<unknown>) => {
      const { userId, reason, detail } = event.payload as UserFlaggedPayload
      await User.findByIdAndUpdate(userId, {
        $set: { flagged: true, flagReason: reason, flaggedAt: new Date() },
      })
      logger.warn({ userId, reason, detail }, 'User flagged via event')
    },
  )
}
