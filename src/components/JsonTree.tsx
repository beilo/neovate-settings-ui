import { useMemo, useState, type CSSProperties } from 'react'
import type { JsonPath } from '../lib/jsonText'

type Props = {
  value: unknown
  selectedPath: JsonPath
  onSelect: (path: JsonPath) => void
}

function typeLabel(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return `数组(${v.length})`
  switch (typeof v) {
    case 'string':
      return '字符串'
    case 'number':
      return '数字'
    case 'boolean':
      return '布尔'
    case 'object':
      return '对象'
    default:
      return '未知'
  }
}

function pathEq(a: JsonPath, b: JsonPath): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

export default function JsonTree({ value, selectedPath, onSelect }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const rootKey = useMemo(() => '$', [])

  function toggle(key: string) {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function renderNode(node: unknown, path: JsonPath, depth: number) {
    const key = path.join('/') || rootKey
    const isSelected = pathEq(path, selectedPath)

    const indentStyle: CSSProperties = { paddingLeft: depth * 12 }

    const isObj = node != null && typeof node === 'object' && !Array.isArray(node)
    const isArr = Array.isArray(node)
    const canExpand = isObj || isArr
    const isExpanded = expanded[key] ?? depth < 1

    const label = path.length === 0 ? '根' : String(path[path.length - 1])
    const hint = typeLabel(node)

    return (
      <div key={key}>
        <div
          className={`treeNode ${isSelected ? 'treeNodeSelected' : ''}`}
          style={indentStyle}
          onClick={() => onSelect(path)}
        >
          <button
            type="button"
            className="treeToggle"
            aria-label={canExpand ? (isExpanded ? '收起' : '展开') : '无子节点'}
            onClick={(e) => {
              e.stopPropagation()
              if (canExpand) toggle(key)
            }}
            disabled={!canExpand}
          >
            {canExpand ? (isExpanded ? '−' : '+') : '·'}
          </button>
          <div className="treeContent">
            <span className="treeLabel">{label}</span>
            <span className="treeType">{hint}</span>
          </div>
        </div>

        {canExpand && isExpanded && (
          <div>
            {isArr &&
              (node as unknown[]).map((child, i) => renderNode(child, [...path, i], depth + 1))}
            {isObj &&
              Object.keys(node as Record<string, unknown>).map((k) =>
                renderNode((node as Record<string, unknown>)[k], [...path, k], depth + 1),
              )}
          </div>
        )}
      </div>
    )
  }

  return <div>{renderNode(value, [], 0)}</div>
}
