# Промпты EAM: медицинский и корпоративный портреты

## Цепочка

1. **Анализ фото** (`/api/analyze`) — Gemini 2.5 Flash по фото генерирует два текстовых промпта: `medicalPrompt` и `corporatePrompt`.
2. **Генерация изображения** (`/api/generate`) — по выбранному стилю (`medical` или `corporate`) берётся соответствующий промпт, оборачивается в общий шаблон и отправляется в Gemini 3 Pro Image (или Imagen 3).

---

## 1. Промпт анализа (запрос к Gemini по фото)

Файл: `app/api/analyze/route.ts`

Системный промпт просит описать человека на фото и вернуть два детальных промпта в JSON:

- **Медицинский портрет (шаблон для Gemini):**  
  Сначала — детальное описание лица человека с фото; затем: «wearing a crisp white medical doctor's coat, professional medical setting. Clean, well-lit studio backdrop in light gray or white. Professional headshot style, shoulders up. Warm, approachable expression. High-quality studio photography lighting.» (стетоскоп убран; акцент на максимальное сходство лица.)

- **Корпоративный портрет (шаблон для Gemini):**  
  «The person in professional business attire (dark suit/blazer). Clean corporate background in dark navy or charcoal gray. Professional headshot style, shoulders up. Confident, professional expression. Studio photography with rim lighting.»

Жёсткие требования: оба промпта должны описывать **одного и того же** человека; в начале каждого промпта — точное описание лица (форма, кожа, волосы, глаза, нос, рот, возраст, отличительные черты), чтобы сгенерированное изображение было максимально похоже на исходное фото. Стетоскоп в медицинском портрете не используется.

В ответе API возвращаются поля `medicalPrompt` и `corporatePrompt` — это уже развёрнутые тексты от Gemini с описанием человека под каждый стиль.

---

## 2. Промпт генерации изображения

Файл: `app/api/generate/route.ts`

На вход приходят `prompt` (один из `medicalPrompt` или `corporatePrompt`) и `style` (`"medical"` или `"corporate"`).

Формируется **общий префикс и суффикс**:

- Префикс (общий для обоих стилей):  
  `"Professional studio headshot portrait photo. " + prompt + ". CRITICAL: The face in the image MUST match the person described above exactly—same face shape, same eyes, same skin tone, same hair, same recognizable identity. Do not alter or idealize the face; preserve maximum likeness to the described person. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture."`

- Суффикс по стилю:
  - **medical:**  
    `" Clean white/light gray backdrop, medical professional aesthetic."`
  - **corporate:**  
    `" Dark corporate backdrop, business professional aesthetic."`

Итоговая строка для модели изображений:

- **Медицинский:**  
  `"Generate a professional portrait photo based on this description: Professional studio headshot portrait photo. [medicalPrompt от анализа]. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. Clean white/light gray backdrop, medical professional aesthetic."`

- **Корпоративный:**  
  `"Generate a professional portrait photo based on this description: Professional studio headshot portrait photo. [corporatePrompt от анализа]. Ultra high quality, 8k resolution, professional photography, sharp focus, natural skin texture. Dark corporate backdrop, business professional aesthetic."`

В API эта итоговая строка передаётся в Gemini 3 Pro Image (и при fallback — в Imagen 3) как текстовый промпт для генерации изображения.

---

## Где менять

- **Шаблоны стилей (халат, костюм, фон, освещение):**  
  `app/api/analyze/route.ts` — блок с текстом `1. MEDICAL PORTRAIT:` и `2. CORPORATE PORTRAIT:`.

- **Общий префикс/суффикс и формулировка для генерации картинки:**  
  `app/api/generate/route.ts` — переменная `enhancedPrompt` и строка `Generate a professional portrait photo based on this description: ${enhancedPrompt}`.
