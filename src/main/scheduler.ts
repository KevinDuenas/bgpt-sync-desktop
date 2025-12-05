/**
 * Sync Scheduler
 * Manages scheduled sync jobs using node-cron
 */
import cron from 'node-cron'
import { DatabaseManager } from './database'
import { SyncEngine } from './sync-engine'
import { ScheduleConfig } from '../shared/types'

export class SyncScheduler {
  private db: DatabaseManager
  private syncEngine: SyncEngine
  private currentTask: cron.ScheduledTask | null = null

  constructor(db: DatabaseManager, syncEngine: SyncEngine) {
    this.db = db
    this.syncEngine = syncEngine
  }

  /**
   * Get current schedule configuration
   */
  getSchedule(): ScheduleConfig | null {
    const scheduleJson = this.db.getConfig('schedule')
    if (!scheduleJson) return null
    return JSON.parse(scheduleJson)
  }

  /**
   * Update schedule configuration
   */
  setSchedule(config: ScheduleConfig): void {
    this.db.setConfig('schedule', JSON.stringify(config))
    this.restart()
  }

  /**
   * Start the scheduler with current configuration
   */
  start(): void {
    const schedule = this.getSchedule()
    if (!schedule || !schedule.enabled) {
      console.log('Scheduler disabled')
      return
    }

    let cronExpression: string

    switch (schedule.frequency) {
      case 'hourly':
        cronExpression = '0 * * * *' // Every hour at minute 0
        break

      case 'daily':
        if (schedule.time) {
          const [hour, minute] = schedule.time.split(':')
          cronExpression = `${minute} ${hour} * * *`
        } else {
          cronExpression = '0 0 * * *' // Midnight
        }
        break

      case 'weekly':
        if (schedule.time && schedule.dayOfWeek !== undefined) {
          const [hour, minute] = schedule.time.split(':')
          cronExpression = `${minute} ${hour} * * ${schedule.dayOfWeek}`
        } else {
          cronExpression = '0 0 * * 0' // Sunday at midnight
        }
        break

      case 'manual':
        console.log('Manual sync only - no schedule')
        return

      default:
        if (schedule.cronExpression) {
          cronExpression = schedule.cronExpression
        } else {
          console.error('Invalid schedule configuration')
          return
        }
    }

    try {
      this.currentTask = cron.schedule(cronExpression, async () => {
        console.log('Scheduled sync triggered')
        if (!this.syncEngine.isSyncRunning()) {
          try {
            await this.syncEngine.performSync('scheduled')
          } catch (error) {
            console.error('Scheduled sync failed:', error)
          }
        } else {
          console.log('Sync already running, skipping scheduled run')
        }
      })

      console.log(`Scheduler started with cron: ${cronExpression}`)
    } catch (error) {
      console.error('Failed to start scheduler:', error)
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.currentTask) {
      this.currentTask.stop()
      this.currentTask = null
      console.log('Scheduler stopped')
    }
  }

  /**
   * Restart the scheduler
   */
  restart(): void {
    this.stop()
    this.start()
  }

  /**
   * Check if scheduler is running
   */
  isRunning(): boolean {
    return this.currentTask !== null
  }
}
