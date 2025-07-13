import { NextRequest, NextResponse } from 'next/server'
import { getAllMemories, deleteUserMemories, searchMemory } from '@/lib/memory'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const query = searchParams.get('query')

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    if (query) {
      // Search memories
      const results = await searchMemory(query, userId)
      return NextResponse.json({ memories: results })
    } else {
      // Get all memories
      const memories = await getAllMemories(userId)
      return NextResponse.json({ memories })
    }
  } catch (error) {
    console.error('Error in memory GET API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const success = await deleteUserMemories(userId)
    
    if (success) {
      return NextResponse.json({ message: 'Memories deleted successfully' })
    } else {
      return NextResponse.json(
        { error: 'Failed to delete memories' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in memory DELETE API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
