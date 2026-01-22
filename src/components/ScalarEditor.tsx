import type { JsonPath } from '../lib/jsonText'
import { pathToDisplay } from '../lib/jsonText'

type Props = {
  path: JsonPath
  value: unknown
  onChange: (nextValue: unknown) => void
}

function classify(v: unknown): 'string' | 'number' | 'boolean' | 'null' | 'other' {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'other'
  switch (typeof v) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'other'
  }
}

export default function ScalarEditor({ path, value, onChange }: Props) {
  const kind = classify(value)

  return (
    <div>
      <div className="hint">选中一个字段后，这里会显示可视化编辑（目前只支持标量：字符串/数字/布尔/null）。</div>
      <div className="path">{pathToDisplay(path)}</div>

      <div style={{ height: 12 }} />

      {kind === 'string' && (
        <div className="kv">
          <div>类型</div>
          <div>字符串</div>
          <div>值</div>
          <input className="input" value={value as string} onChange={(e) => onChange(e.target.value)} />
        </div>
      )}

      {kind === 'number' && (
        <div className="kv">
          <div>类型</div>
          <div>数字</div>
          <div>值</div>
          <input
            className="input"
            inputMode="decimal"
            value={String(value)}
            onChange={(e) => {
              const raw = e.target.value.trim()
              if (raw === '') return
              const n = Number(raw)
              if (!Number.isNaN(n)) onChange(n)
            }}
          />
        </div>
      )}

      {kind === 'boolean' && (
        <div className="kv">
          <div>类型</div>
          <div>布尔</div>
          <div>值</div>
          <select
            className="select"
            value={(value as boolean) ? 'true' : 'false'}
            onChange={(e) => onChange(e.target.value === 'true')}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </div>
      )}

      {kind === 'null' && (
        <div className="kv">
          <div>类型</div>
          <div>null</div>
          <div>值</div>
          <div className="hint">null 没有可编辑值</div>
        </div>
      )}

      {kind === 'other' && (
        <div className="error">当前节点不是标量（可能是对象/数组）。为了保持简单，我先不做复杂表单。</div>
      )}
    </div>
  )
}

