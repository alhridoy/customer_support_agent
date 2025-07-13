import { NextRequest, NextResponse } from 'next/server'
import { scheduleMeeting } from '@/lib/meeting-scheduler'
import { MeetingRequest } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const meetingRequest: MeetingRequest = await request.json()

    const result = await scheduleMeeting(meetingRequest)

    if (result.success) {
      return NextResponse.json({
        success: true,
        meetingId: result.meetingId,
        message: 'Meeting scheduled successfully'
      })
    } else {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 })
    }
  } catch (error) {
    console.error('Error in schedule-meeting API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
