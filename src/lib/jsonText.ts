import { applyEdits, modify, type FormattingOptions } from 'jsonc-parser'

export type JsonPath = Array<string | number>

function detectEol(text: string): string {
  // 为什么：用户要求“尽量保留格式”，换行符属于格式的一部分（\n vs \r\n）。
  return text.includes('\r\n') ? '\r\n' : '\n'
}

function detectIndent(text: string): { insertSpaces: boolean; tabSize: number } {
  // 为什么：jsonc-parser 的增量修改需要 formattingOptions；从原文件猜一个最接近的缩进风格。
  const tabMatch = text.match(/\n(\t+)"/)
  if (tabMatch) return { insertSpaces: false, tabSize: 1 }

  const spaceMatch = text.match(/\n( +)"/)
  if (spaceMatch) {
    const size = spaceMatch[1].length
    if (size > 0 && size <= 8) return { insertSpaces: true, tabSize: size }
  }
  return { insertSpaces: true, tabSize: 2 }
}

export function applyPathUpdate(
  text: string,
  path: JsonPath,
  value: unknown,
): { nextText: string; ok: true } | { ok: false; message: string } {
  const { insertSpaces, tabSize } = detectIndent(text)
  const formattingOptions: FormattingOptions = {
    insertSpaces,
    tabSize,
    eol: detectEol(text),
  }

  try {
    // 为什么：用 jsonc-parser 做“最小文本编辑”，尽量不重排/不重格式化整份文件。
    const edits = modify(text, path, value, { formattingOptions })
    const nextText = applyEdits(text, edits)
    return { ok: true, nextText }
  } catch (e) {
    return { ok: false, message: `修改 JSON 失败：${String(e)}` }
  }
}

export function pathToDisplay(path: JsonPath): string {
  if (path.length === 0) return '$'
  let out = '$'
  for (const seg of path) {
    if (typeof seg === 'number') out += `[${seg}]`
    else if (/^[a-zA-Z_$][\w$]*$/.test(seg)) out += `.${seg}`
    else out += `[${JSON.stringify(seg)}]`
  }
  return out
}

export function getValueAtPath(value: unknown, path: JsonPath): unknown {
  // 为什么：尽量别用 any；路径读取这里用最小类型守卫就够了。
  let cur: unknown = value
  for (const seg of path) {
    if (cur == null) return undefined

    if (typeof seg === 'number') {
      if (!Array.isArray(cur)) return undefined
      cur = cur[seg]
      continue
    }

    if (typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}
