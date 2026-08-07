/**
 * IEEE 文章標題 sentence case 轉換。
 *
 * IEEE reference list 的文章標題應採 sentence case：原則上僅「首字、
 * 冒號後首字」與「專有名詞／縮寫」大寫。metadata 供應商常回傳 Title Case
 * （例如 "Big Data and Learning Analytics in Higher Education"），
 * 因此於 IEEE 格式輸出前做此轉換。
 *
 * 轉換採保守策略，只降小寫「可安全轉換」的單字：
 * - 保留全大寫縮寫（AI、MOOC、IEEE、COVID-19）
 * - 保留含內部大寫的商標／專名（LaTeX、iPhone、OpenAlex）
 * - 保留含句點的字（U.S.、e.g.、Ph.D.）
 * - 保留以數字開頭的字（3D）
 * - 句子開頭（整段開頭、冒號／句點／問號／驚嘆號之後）的首字維持大寫
 * - 其餘字降為小寫（Learning → learning）
 */

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

  return false
}

function capitalizeFirst(word: string) {
  return word.charAt(0).toLocaleUpperCase("en-US") + word.slice(1)
}

/**
 * 將文章標題轉成 sentence case。
 */
export function sentenceCaseTitle(title: string) {
  const tokens = title.split(/(\s+)/)
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
}
