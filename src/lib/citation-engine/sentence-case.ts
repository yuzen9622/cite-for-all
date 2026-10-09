// Only lowercase common bibliographic words. Unknown capitals require human review.
const COMMON_WORDS = new Set(
  "a an the of on in with and or for from to by at as effects effectiveness learning memory big data analytics higher education look use cases standard study massive open online courses case intelligent tutoring systems meta-analytic review test title reference guide measurements cells programming".split(
    " ",
  ),
)

function shouldPreserveCase(word: string) {
  const letters = word.match(/\p{L}/gu) ?? []

  if (letters.length === 0) {
    return true
  }

  // 含句點的字（縮寫：U.S.、e.g.）
  if (word.includes(".")) {
    return true
  }

  // 以連字號分隔的片段中，若任一片段為全大寫縮寫（AI-Powered、COVID-19），
  // 保留整個字以不拆壞縮寫。
  if (
    word.includes("-") &&
    word.split("-").some((part) => /^[\p{Lu}]{2,}$/u.test(part))
  ) {
    return true
  }

  // 全大寫縮寫（AI、IEEE、COVID-19）
  const hasLowercaseLetter = /[\p{Ll}]/u.test(word)
  if (!hasLowercaseLetter) {
    return true
  }

  // 含內部大寫（camelCase：LaTeX、iPhone、OpenAlex）
  if (/[\p{Ll}][\p{Lu}]/u.test(word)) {
    return true
  }

  return (
    /^[A-Z]/.test(word) &&
    !COMMON_WORDS.has(word.toLowerCase().replace(/[,;:!?]$/g, ""))
  )
}

function capitalizeFirst(word: string) {
  return word.charAt(0).toLocaleUpperCase("en-US") + word.slice(1)
}

/**
 * 將文章標題轉成 sentence case。
 */
export function sentenceCaseTitle(title: string) {
  const protectedParts: string[] = []
  const protectedTitle = title.replace(
    /<(?:span|i|b|sup|sub)\b[^>]*>.*?<\/(?:span|i|b|sup|sub)>/gi,
    (value) => {
      protectedParts.push(value)
      return `PROTECTED${protectedParts.length - 1}TOKEN`
    },
  )
  const tokens = protectedTitle.split(/(\s+)/)
  let lastNonSpace = ""

  return tokens
    .map((token) => {
      if (/^\s+$/.test(token) || token === "") {
        return token
      }

      const startsSentence = lastNonSpace === "" || /[:.!?]$/.test(lastNonSpace)

      if (shouldPreserveCase(token)) {
        lastNonSpace = token
        return token
      }

      lastNonSpace = token
      return startsSentence
        ? capitalizeFirst(token)
        : token.toLocaleLowerCase("en-US")
    })
    .join("")
    .replace(
      /PROTECTED(\d+)TOKEN/g,
      (_, index) => protectedParts[Number(index)],
    )
}

export function titleNeedsReview(title: string, language?: string) {
  if (language && !/^en(?:-|$)/i.test(language)) return false
  const words = title.replace(/<[^>]+>/g, "").split(/\s+/)
  return words
    .slice(1)
    .some((word) => /^[A-Z][a-z]+/.test(word) && shouldPreserveCase(word))
}
