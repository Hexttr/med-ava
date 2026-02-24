/**
 * Сжимает изображение для хранения в localStorage (избегаем QuotaExceededError).
 * Макс. размер 800px, JPEG качество 0.75.
 */
export function compressImageForStorage(
  source: File | string,
  maxSize = 800,
  quality = 0.75
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"

    img.onload = () => {
      try {
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = Math.round((h * maxSize) / w)
            w = maxSize
          } else {
            w = Math.round((w * maxSize) / h)
            h = maxSize
          }
        }

        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Canvas 2d not available"))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("toBlob failed"))
              return
            }
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = () => reject(reader.error)
            reader.readAsDataURL(blob)
          },
          "image/jpeg",
          quality
        )
      } catch (e) {
        reject(e)
      }
    }

    img.onerror = () => reject(new Error("Image load failed"))

    if (typeof source === "string") {
      img.src = source
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        img.src = reader.result as string
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(source)
    }
  })
}
