import { NextRequest, NextResponse } from 'next/server'
import { meetingScheduler } from '@/utils/meeting-scheduler'

/**
 * Meeting Management API
 * Handles meeting scheduling, cancellation, and management
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'list':
        const userMeetings = meetingScheduler.getUserMeetings(userId)
        return NextResponse.json({ meetings: userMeetings })

      case 'available':
        const meetingType = searchParams.get('meetingType')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')
        
        const availableSlots = meetingScheduler.getAvailableSlots(
          meetingType || undefined,
          startDate || undefined,
          endDate || undefined
        )
        
        return NextResponse.json({ availableSlots })

      case 'stats':
        const stats = meetingScheduler.getMeetingStats()
        return NextResponse.json({ stats })

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in meetings GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, userId, ...requestData } = body

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'schedule':
        const { preferredDate, preferredTime, meetingType, customerNotes } = requestData
        
        if (!preferredDate || !preferredTime) {
          return NextResponse.json(
            { error: 'Date and time are required' },
            { status: 400 }
          )
        }

        const scheduleResult = await meetingScheduler.scheduleMeeting({
          userId,
          preferredDate,
          preferredTime,
          meetingType: meetingType || 'general',
          customerNotes
        })

        return NextResponse.json(scheduleResult)

      case 'cancel':
        const { meetingId } = requestData
        
        if (!meetingId) {
          return NextResponse.json(
            { error: 'Meeting ID is required' },
            { status: 400 }
          )
        }

        const cancelResult = await meetingScheduler.cancelMeeting(meetingId, userId)
        return NextResponse.json(cancelResult)

      case 'reschedule':
        const { meetingId: rescheduleId, newDate, newTime } = requestData
        
        if (!rescheduleId || !newDate || !newTime) {
          return NextResponse.json(
            { error: 'Meeting ID, new date, and new time are required' },
            { status: 400 }
          )
        }

        const rescheduleResult = await meetingScheduler.rescheduleMeeting(
          rescheduleId,
          userId,
          newDate,
          newTime
        )

        return NextResponse.json(rescheduleResult)

      case 'natural':
        const { message } = requestData
        
        if (!message) {
          return NextResponse.json(
            { error: 'Message is required for natural language scheduling' },
            { status: 400 }
          )
        }

        const naturalResult = await meetingScheduler.parseAndSchedule(message, userId)
        return NextResponse.json(naturalResult)

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in meetings POST API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}