import { subscribeToEvents } from '@craft/shared'
import { UserProfile } from '../models/UserProfile'
import { logger } from '@craft/shared'
import { BaseEvent, UserRegisteredPayload } from '@craft/shared'

export async function startProfileEventConsumer(): Promise<void> {
  await subscribeToEvents(
    'profile-service-queue',
    ['user.registered', 'user.deleted'],
    async (event: BaseEvent<unknown>) => {
      const log = logger.child({
        correlationId: event.correlationId,
        eventType: event.eventType,
      })

      if (event.eventType === 'user.registered') {
        const payload = event.payload as UserRegisteredPayload
        const existing = await UserProfile.findOne({ userId: payload.userId })
        if (!existing) {
          await UserProfile.create({
            userId: payload.userId,
            email: payload.email,
            fullName: payload.fullName,
          })
          log.info(
            { userId: payload.userId },
            'Profile created from user.registered event',
          )
        }
      }

      if (event.eventType === 'user.deleted') {
        const { userId } = event.payload as { userId: string }
        await UserProfile.findOneAndDelete({ userId })
        log.info({ userId }, 'Profile deleted from user.deleted event')
      }
    },
  )
}
