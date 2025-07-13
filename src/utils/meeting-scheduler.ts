import { AvenKnowledgeItem } from '@/types'

/**
 * Meeting Scheduler Tool
 * Handles appointment scheduling for Aven customers
 */

interface MeetingRequest {
  userId: string
  preferredDate: string
  preferredTime: string
  timezone?: string
  meetingType: 'consultation' | 'application_help' | 'account_review' | 'general'
  customerNotes?: string
}

interface MeetingSlot {
  id: string
  date: string
  time: string
  duration: number // minutes
  available: boolean
  meetingType: string[]
}

interface ScheduledMeeting {
  id: string
  userId: string
  date: string
  time: string
  duration: number
  meetingType: string
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed'
  customerNotes?: string
  reminderSent: boolean
  createdAt: Date
}

export class MeetingScheduler {
  private availableSlots: Map<string, MeetingSlot> = new Map()
  private scheduledMeetings: Map<string, ScheduledMeeting> = new Map()

  constructor() {
    this.initializeAvailableSlots()
  }

  /**
   * Initialize available meeting slots
   */
  private initializeAvailableSlots(): void {
    const today = new Date()
    const businessDays = []
    
    // Generate next 30 business days
    for (let i = 1; i <= 45; i++) {
      const date = new Date(today)
      date.setDate(today.getDate() + i)
      
      // Skip weekends
      if (date.getDay() !== 0 && date.getDay() !== 6) {
        businessDays.push(date)
      }
      
      if (businessDays.length >= 30) break
    }

    // Create time slots for each business day
    businessDays.forEach(date => {
      const dateStr = date.toISOString().split('T')[0]
      
      // Available times: 9 AM to 5 PM, every hour
      for (let hour = 9; hour <= 17; hour++) {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`
        const slotId = `${dateStr}-${timeStr}`
        
        this.availableSlots.set(slotId, {
          id: slotId,
          date: dateStr,
          time: timeStr,
          duration: 60,
          available: true,
          meetingType: ['consultation', 'application_help', 'account_review', 'general']
        })
      }
    })
  }

  /**
   * Get available meeting slots
   */
  getAvailableSlots(
    meetingType?: string,
    startDate?: string,
    endDate?: string
  ): MeetingSlot[] {
    const slots = Array.from(this.availableSlots.values())
    
    return slots.filter(slot => {
      if (!slot.available) return false
      
      if (meetingType && !slot.meetingType.includes(meetingType)) {
        return false
      }
      
      if (startDate && slot.date < startDate) return false
      if (endDate && slot.date > endDate) return false
      
      return true
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.time.localeCompare(b.time)
    })
  }

  /**
   * Schedule a meeting
   */
  async scheduleMeeting(request: MeetingRequest): Promise<{
    success: boolean
    meeting?: ScheduledMeeting
    message: string
  }> {
    const { userId, preferredDate, preferredTime, meetingType, customerNotes } = request
    
    // Validate date format
    if (!this.isValidDate(preferredDate)) {
      return {
        success: false,
        message: 'Please provide a valid date in YYYY-MM-DD format.'
      }
    }

    // Validate time format
    if (!this.isValidTime(preferredTime)) {
      return {
        success: false,
        message: 'Please provide a valid time in HH:MM format (24-hour).'
      }
    }

    // Check if the requested slot is available
    const slotId = `${preferredDate}-${preferredTime}`
    const slot = this.availableSlots.get(slotId)
    
    if (!slot || !slot.available) {
      const alternatives = this.getAvailableSlots(meetingType, preferredDate)
        .slice(0, 3)
        .map(s => `${s.date} at ${s.time}`)
        .join(', ')
      
      return {
        success: false,
        message: `The requested time slot is not available. Alternative times: ${alternatives || 'Please check our available slots.'}`
      }
    }

    if (!slot.meetingType.includes(meetingType)) {
      return {
        success: false,
        message: `The requested meeting type "${meetingType}" is not available for this time slot.`
      }
    }

    // Create the meeting
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const meeting: ScheduledMeeting = {
      id: meetingId,
      userId,
      date: preferredDate,
      time: preferredTime,
      duration: slot.duration,
      meetingType,
      status: 'scheduled',
      customerNotes,
      reminderSent: false,
      createdAt: new Date()
    }

    // Book the slot
    slot.available = false
    this.scheduledMeetings.set(meetingId, meeting)

    console.log(`📅 Meeting scheduled: ${meetingId} for ${userId} on ${preferredDate} at ${preferredTime}`)

    return {
      success: true,
      meeting,
      message: `Your meeting has been scheduled for ${preferredDate} at ${preferredTime}. You will receive a confirmation email shortly.`
    }
  }

  /**
   * Cancel a meeting
   */
  async cancelMeeting(meetingId: string, userId: string): Promise<{
    success: boolean
    message: string
  }> {
    const meeting = this.scheduledMeetings.get(meetingId)
    
    if (!meeting) {
      return {
        success: false,
        message: 'Meeting not found.'
      }
    }

    if (meeting.userId !== userId) {
      return {
        success: false,
        message: 'You can only cancel your own meetings.'
      }
    }

    if (meeting.status === 'cancelled') {
      return {
        success: false,
        message: 'This meeting is already cancelled.'
      }
    }

    // Cancel the meeting and free up the slot
    meeting.status = 'cancelled'
    const slotId = `${meeting.date}-${meeting.time}`
    const slot = this.availableSlots.get(slotId)
    if (slot) {
      slot.available = true
    }

    console.log(`❌ Meeting cancelled: ${meetingId}`)

    return {
      success: true,
      message: `Your meeting on ${meeting.date} at ${meeting.time} has been cancelled.`
    }
  }

  /**
   * Get user's scheduled meetings
   */
  getUserMeetings(userId: string): ScheduledMeeting[] {
    return Array.from(this.scheduledMeetings.values())
      .filter(meeting => meeting.userId === userId && meeting.status !== 'cancelled')
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date)
        return a.time.localeCompare(b.time)
      })
  }

  /**
   * Reschedule a meeting
   */
  async rescheduleMeeting(
    meetingId: string,
    userId: string,
    newDate: string,
    newTime: string
  ): Promise<{
    success: boolean
    meeting?: ScheduledMeeting
    message: string
  }> {
    const meeting = this.scheduledMeetings.get(meetingId)
    
    if (!meeting || meeting.userId !== userId) {
      return {
        success: false,
        message: 'Meeting not found or access denied.'
      }
    }

    // Free up the old slot
    const oldSlotId = `${meeting.date}-${meeting.time}`
    const oldSlot = this.availableSlots.get(oldSlotId)
    if (oldSlot) {
      oldSlot.available = true
    }

    // Try to schedule in the new slot
    const rescheduleRequest: MeetingRequest = {
      userId,
      preferredDate: newDate,
      preferredTime: newTime,
      meetingType: meeting.meetingType as any,
      customerNotes: meeting.customerNotes
    }

    const result = await this.scheduleMeeting(rescheduleRequest)
    
    if (result.success) {
      // Remove old meeting and update with new one
      this.scheduledMeetings.delete(meetingId)
      console.log(`🔄 Meeting rescheduled: ${meetingId} from ${meeting.date} ${meeting.time} to ${newDate} ${newTime}`)
    } else {
      // Restore the old slot if rescheduling failed
      if (oldSlot) {
        oldSlot.available = false
      }
    }

    return result
  }

  /**
   * Natural language meeting scheduling
   */
  async parseAndSchedule(
    naturalLanguageRequest: string,
    userId: string
  ): Promise<{
    success: boolean
    meeting?: ScheduledMeeting
    message: string
    parsedRequest?: MeetingRequest
  }> {
    const parsed = this.parseNaturalLanguageRequest(naturalLanguageRequest)
    
    if (!parsed) {
      return {
        success: false,
        message: 'I couldn\'t understand your scheduling request. Please specify a date and time, like "Schedule a meeting for tomorrow at 2 PM" or "Book an appointment on December 15th at 10:00 AM".'
      }
    }

    const meetingRequest: MeetingRequest = {
      userId,
      preferredDate: parsed.date,
      preferredTime: parsed.time,
      meetingType: parsed.meetingType || 'general',
      customerNotes: parsed.notes
    }

    const result = await this.scheduleMeeting(meetingRequest)
    
    return {
      ...result,
      parsedRequest: meetingRequest
    }
  }

  /**
   * Parse natural language scheduling requests
   */
  private parseNaturalLanguageRequest(request: string): {
    date: string
    time: string
    meetingType?: string
    notes?: string
  } | null {
    const lowerRequest = request.toLowerCase()
    
    // Extract meeting type
    let meetingType = 'general'
    if (lowerRequest.includes('consultation') || lowerRequest.includes('consult')) {
      meetingType = 'consultation'
    } else if (lowerRequest.includes('application') || lowerRequest.includes('apply')) {
      meetingType = 'application_help'
    } else if (lowerRequest.includes('review') || lowerRequest.includes('account')) {
      meetingType = 'account_review'
    }

    // Extract date
    const today = new Date()
    let targetDate = new Date()

    // Handle relative dates
    if (lowerRequest.includes('tomorrow')) {
      targetDate.setDate(today.getDate() + 1)
    } else if (lowerRequest.includes('next week')) {
      targetDate.setDate(today.getDate() + 7)
    } else if (lowerRequest.includes('monday')) {
      targetDate = this.getNextWeekday(1) // Monday = 1
    } else if (lowerRequest.includes('tuesday')) {
      targetDate = this.getNextWeekday(2)
    } else if (lowerRequest.includes('wednesday')) {
      targetDate = this.getNextWeekday(3)
    } else if (lowerRequest.includes('thursday')) {
      targetDate = this.getNextWeekday(4)
    } else if (lowerRequest.includes('friday')) {
      targetDate = this.getNextWeekday(5)
    } else {
      // Try to extract explicit dates
      const dateMatch = request.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})|(\d{1,2}-\d{1,2}-\d{4})/)
      if (dateMatch) {
        const dateStr = dateMatch[0]
        if (dateStr.includes('/')) {
          const [month, day, year] = dateStr.split('/')
          targetDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
        } else if (dateStr.includes('-') && dateStr.length === 10) {
          targetDate = new Date(dateStr)
        }
      }
    }

    // Extract time
    let time = '10:00' // default
    const timeMatch = request.match(/(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)?|\b(\d{1,2})\s*(am|pm|AM|PM)\b/)
    
    if (timeMatch) {
      let hour = parseInt(timeMatch[1] || timeMatch[4])
      const minute = timeMatch[2] ? parseInt(timeMatch[2]) : 0
      const period = timeMatch[3] || timeMatch[5]
      
      if (period && period.toLowerCase() === 'pm' && hour !== 12) {
        hour += 12
      } else if (period && period.toLowerCase() === 'am' && hour === 12) {
        hour = 0
      }
      
      time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
    }

    // Validate business hours (9 AM - 5 PM)
    const hourNum = parseInt(time.split(':')[0])
    if (hourNum < 9 || hourNum > 17) {
      time = '10:00' // Default to 10 AM if outside business hours
    }

    const dateStr = targetDate.toISOString().split('T')[0]
    
    return {
      date: dateStr,
      time,
      meetingType,
      notes: request
    }
  }

  private getNextWeekday(targetDay: number): Date {
    const today = new Date()
    const currentDay = today.getDay()
    const daysUntilTarget = targetDay === 0 ? 7 : targetDay // Sunday = 0, but we want next Sunday to be 7 days away
    
    let daysToAdd = (daysUntilTarget - currentDay + 7) % 7
    if (daysToAdd === 0) daysToAdd = 7 // If it's the same day, get next week's occurrence
    
    const targetDate = new Date(today)
    targetDate.setDate(today.getDate() + daysToAdd)
    return targetDate
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr)
    return date instanceof Date && !isNaN(date.getTime()) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)
  }

  private isValidTime(timeStr: string): boolean {
    return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(timeStr)
  }

  /**
   * Get meeting statistics
   */
  getMeetingStats(): {
    totalScheduled: number
    upcomingMeetings: number
    availableSlots: number
    meetingsByType: Record<string, number>
  } {
    const meetings = Array.from(this.scheduledMeetings.values())
    const today = new Date().toISOString().split('T')[0]
    
    const upcomingMeetings = meetings.filter(m => 
      m.status === 'scheduled' && m.date >= today
    ).length

    const meetingsByType = meetings.reduce((acc, meeting) => {
      acc[meeting.meetingType] = (acc[meeting.meetingType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return {
      totalScheduled: meetings.length,
      upcomingMeetings,
      availableSlots: Array.from(this.availableSlots.values()).filter(s => s.available).length,
      meetingsByType
    }
  }
}

export const meetingScheduler = new MeetingScheduler()