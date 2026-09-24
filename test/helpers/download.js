import download from 'downloadjs'

// Tests that save files mock downloadjs: vi.mock(`downloadjs`, () => ({default: vi.fn()}))

// The text of a Blob (jsdom's Blob has no text())
export const textOf = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(reader.error)
  reader.readAsText(blob)
})

// What the last call of the mocked downloadjs saved: its text, file name and MIME type (and the Blob)
export const lastDownload = async () => {
  const calls = download.mock.calls
  if (calls.length === 0) {
    throw new Error(`nothing was downloaded`)
  }
  const [blob, fileName, mimeType] = calls[calls.length - 1]
  return {blob, content: await textOf(blob), fileName, mimeType}
}
