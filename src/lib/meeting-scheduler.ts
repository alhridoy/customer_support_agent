import { MeetingRequest } from '@/types'

export async function scheduleMeeting(request: MeetingRequest): Promise<{ success: boolean; meetingId?: string; error?: string }> {
  try {
    // Validate the meeting request
    const validation = validateMeetingRequest(request)
    if (!validation.isValid) {
      return { success: false, error: validation.error }
    }

    // In a real implementation, this would integrate with a calendar service
    // For now, we'll simulate scheduling
    const meetingId = `meeting-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Log the meeting request (in production, this would save to database)
    console.log('Meeting scheduled:', {
      meetingId,
      ...request,
      scheduledAt: new Date()
    })

    // Send confirmation email (simulated)
    await sendMeetingConfirmation(request, meetingId)

    return { success: true, meetingId }
  } catch (error) {
    console.error('Error scheduling meeting:', error)
    return { success: false, error: 'Failed to schedule meeting' }
  }
}

function validateMeetingRequest(request: MeetingRequest): { isValid: boolean; error?: string } {
  // Validate date
  const requestDate = new Date(request.date)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (requestDate < today) {
    return { isValid: false, error: 'Meeting date cannot be in the past' }
  }

  // Validate business hours (9 AM - 5 PM)
  const [hour, minute] = request.time.split(':').map(Number)
  if (hour < 9 || hour >= 17) {
    return { isValid: false, error: 'Meeting time must be between 9 AM and 5 PM' }
  }

  // Validate weekday
  const dayOfWeek = requestDate.getDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isValid: false, error: 'Meetings can only be scheduled on weekdays' }
  }

  // Validate contact information
  if (!request.contactInfo.name || !request.contactInfo.email) {
    return { isValid: false, error: 'Name and email are required' }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(request.contactInfo.email)) {
    return { isValid: false, error: 'Please provide a valid email address' }
  }

  return { isValid: true }
}

async function sendMeetingConfirmation(request: MeetingRequest, meetingId: string): Promise<void> {
  // In a real implementation, this would send an actual email
  console.log('Sending meeting confirmation email:', {
    to: request.contactInfo.email,
    subject: 'Aven Meeting Confirmation',
    body: `Dear ${request.contactInfo.name},

Your meeting has been scheduled for ${request.date} at ${request.time}.

Meeting Purpose: ${request.purpose}
Meeting ID: ${meetingId}

We'll send you a calendar invitation shortly. If you need to reschedule, please contact us at least 24 hours in advance.

Best regards,
Aven Customer Support Team`
  })
}

export function getAvailableTimeSlots(date: string): string[] {
  // In a real implementation, this would check actual calendar availability
  const slots = []
  
  // Generate 30-minute slots from 9 AM to 5 PM
  for (let hour = 9; hour < 17; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      slots.push(timeString)
    }
  }
  
  return slots
}

export function parseMeetingRequest(userMessage: string): Partial<MeetingRequest> | null {
  const message = userMessage.toLowerCase()
  
  // Check if this is a meeting request
  const meetingKeywords = ['meeting', 'schedule', 'appointment', 'call', 'speak with', 'talk to']
  const hasMeetingKeyword = meetingKeywords.some(keyword => message.includes(keyword))
  
  if (!hasMeetingKeyword) {
    return null
  }

  // Extract date patterns
  const datePatterns = [
    /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/, // MM/DD/YYYY or MM-DD-YYYY
    /\b(\d{2,4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/, // YYYY/MM/DD or YYYY-MM-DD
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/,
    /\b(tomorrow|today|next week|this week)\b/,
  ]

  // Extract time patterns
  const timePatterns = [
    /\b(\d{1,2}):(\d{2})\s*(am|pm)\b/,
    /\b(\d{1,2})\s*(am|pm)\b/,
    /\b(\d{1,2}):(\d{2})\b/,
  ]

  const request: Partial<MeetingRequest> = {}

  // Try to extract date
  for (const pattern of datePatterns) {
    const match = message.match(pattern)
    if (match) {
      // This is a simplified extraction - in production, use a proper date parsing library
      request.date = match[0]
      break
    }
  }

  // Try to extract time
  for (const pattern of timePatterns) {
    const match = message.match(pattern)
    if (match) {
      request.time = match[0]
      break
    }
  }

  // Extract purpose
  const purposeKeywords = ['about', 'regarding', 'discuss', 'question', 'help with']
  for (const keyword of purposeKeywords) {
    const index = message.indexOf(keyword)
    if (index !== -1) {
      const purposeText = message.substring(index).split('.')[0]
      request.purpose = purposeText.length > 10 ? purposeText : 'General inquiry'
      break
    }
  }

  if (!request.purpose) {
    request.purpose = 'General inquiry about Aven services'
  }

  return Object.keys(request).length > 0 ? request : null
}

export function generateMeetingSchedulingResponse(partialRequest: Partial<MeetingRequest>): string {
  const hasDate = partialRequest.date
  const hasTime = partialRequest.time
  const hasPurpose = partialRequest.purpose

  if (hasDate && hasTime && hasPurpose) {
    return `I'd be happy to help you schedule a meeting for ${partialRequest.date} at ${partialRequest.time} regarding ${partialRequest.purpose}. 

To complete the scheduling, I'll need your contact information:
- Full name
- Email address
- Phone number (optional)

Please provide these details so I can confirm your appointment.`
  }

  let response = "I'd be happy to help you schedule a meeting with our team. "

  if (!hasDate) {
    response += "What date would work best for you? We're available Monday through Friday. "
  }

  if (!hasTime) {
    response += "What time would you prefer? We have availability from 9 AM to 5 PM. "
  }

  if (!hasPurpose) {
    response += "What would you like to discuss in the meeting? "
  }

  response += "\n\nOnce you provide these details, I'll also need your contact information to confirm the appointment."

  return response
}
