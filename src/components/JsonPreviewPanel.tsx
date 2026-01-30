import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'
import { usePreviewStore } from '../store/previewStore'

type Props = {
  width: number
}

// 为什么：JSON 预览区单独组件，方便维护样式与行为。
export default function JsonPreviewPanel({ width }: Props) {
  const state = usePreviewStore((store) => store.state)

  // 为什么：store 未就绪时先不渲染，避免空引用报错。
  if (!state) return null

  return (
    <div className="json-panel" style={{ width }}>
      <div className="json-panel-header">JSON Preview</div>
      <div className="json-panel-content">
        <CodeMirror
          value={state.previewText}
          height="100%"
          theme={oneDark}
          extensions={[json()]}
          editable={false}
          readOnly
          style={{ height: '100%', fontFamily: "'JetBrains Mono', Menlo, Monaco, monospace", fontSize: 12 }}
        />
      </div>
    </div>
  )
}
