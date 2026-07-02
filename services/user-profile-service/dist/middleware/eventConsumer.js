"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startProfileEventConsumer = startProfileEventConsumer;
const shared_1 = require("@craft/shared");
const UserProfile_1 = require("../models/UserProfile");
const shared_2 = require("@craft/shared");
async function startProfileEventConsumer() {
    await (0, shared_1.subscribeToEvents)('profile-service-queue', ['user.registered', 'user.deleted'], async (event) => {
        const log = shared_2.logger.child({
            correlationId: event.correlationId,
            eventType: event.eventType,
        });
        if (event.eventType === 'user.registered') {
            const payload = event.payload;
            const existing = await UserProfile_1.UserProfile.findOne({ userId: payload.userId });
            if (!existing) {
                await UserProfile_1.UserProfile.create({
                    userId: payload.userId,
                    email: payload.email,
                    fullName: payload.fullName,
                });
                log.info({ userId: payload.userId }, 'Profile created from user.registered event');
            }
        }
        if (event.eventType === 'user.deleted') {
            const { userId } = event.payload;
            await UserProfile_1.UserProfile.findOneAndDelete({ userId });
            log.info({ userId }, 'Profile deleted from user.deleted event');
        }
    });
}
