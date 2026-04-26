import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const slug = formData.get('slug') as string
    const fieldId = formData.get('fieldId') as string

    if (!file || !slug || !fieldId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Maximum size is 10MB.' }, { status: 400 })
    }

    // Build storage path: briefings/{slug}/{fieldId}/{timestamp}-{filename}
    const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
    const safeName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 100)
    const path = `briefings/${slug}/${fieldId}/${Date.now()}-${safeName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('briefing-files')
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin.storage
      .from('briefing-files')
      .getPublicUrl(path)

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      size: file.size,
      type: file.type,
      path,
    })
  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
