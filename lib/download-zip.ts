import JSZip from 'jszip'

export interface FileEntry {
  url: string
  name: string
  type?: string
  size?: number
}

export async function downloadAsZip(files: FileEntry[], zipName: string = 'arquivos.zip') {
  const zip = new JSZip()
  const folder = zip.folder('arquivos') || zip

  // Deduplicate filenames
  const usedNames = new Map<string, number>()
  
  const fetchPromises = files
    .filter(f => f.url && f.url.startsWith('http'))
    .map(async (f) => {
      try {
        const response = await fetch(f.url)
        if (!response.ok) return
        const blob = await response.blob()
        
        // Handle duplicate filenames
        const baseName = f.name || 'arquivo'
        const count = usedNames.get(baseName) || 0
        usedNames.set(baseName, count + 1)
        const finalName = count > 0 ? `${baseName.replace(/\.([^.]+)$/, '')}_${count}.$1` : baseName
        
        folder.file(finalName, blob)
      } catch (e) {
        console.warn(`Failed to fetch ${f.name}:`, e)
      }
    })

  await Promise.all(fetchPromises)

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = zipName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
