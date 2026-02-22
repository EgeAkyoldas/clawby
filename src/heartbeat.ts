import cron from "node-cron";
import type { Bot } from "grammy";
import { config } from "./config.js";

let heartbeatTask: cron.ScheduledTask | null = null;

const HEARTBEAT_MESSAGE =
  "🌅 *Good morning!*\n\n" +
  "1️⃣ What is your \\#1 priority today?\n" +
  "2️⃣ Any blocker I should help remove?";

/**
 * Send the heartbeat message to all allowlisted users.
 */
export async function triggerHeartbeat(bot: Bot): Promise<void> {
  for (const userId of config.allowedUserIds) {
    try {
      await bot.api.sendMessage(userId, HEARTBEAT_MESSAGE, {
        parse_mode: "Markdown",
      });
      console.log(`  💓 Heartbeat sent to user ${userId}`);
    } catch (err) {
      console.error(
        `  ❌ Heartbeat failed for user ${userId}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

/**
 * Start the daily heartbeat cron job.
 */
export function startHeartbeat(bot: Bot): void {
  if (!config.heartbeatEnabled) {
    return;
  }

  const cronExpr = config.heartbeatCron;

  if (!cron.validate(cronExpr)) {
    console.error(`  ❌ Invalid HEARTBEAT_CRON expression: "${cronExpr}"`);
    return;
  }

  heartbeatTask = cron.schedule(cronExpr, () => {
    console.log("  💓 Heartbeat cron triggered");
    triggerHeartbeat(bot);
  });

  console.log(`   💓 Heartbeat: enabled (${cronExpr})`);
}

/**
 * Stop the heartbeat cron job.
 */
export function stopHeartbeat(): void {
  if (heartbeatTask) {
    heartbeatTask.stop();
    heartbeatTask = null;
  }
}
