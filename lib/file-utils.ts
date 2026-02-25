/**
 * Читает файл как data URL без сжатия.
 * Используется для фото, которые пойдут в генерацию — сжатие снижает качество и похожесть.
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
