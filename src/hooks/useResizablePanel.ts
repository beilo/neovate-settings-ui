import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'

// 为什么：拖拽分割线逻辑独立，避免 App.tsx 过度臃肿。
export function useResizablePanel(initialWidth: number) {
  const [width, setWidth] = useState<number>(initialWidth)
  const isDraggingRef = useRef<boolean>(false)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(initialWidth)

  const onMouseDown = useCallback((e: ReactMouseEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return
      // 为什么：向左拖动增加宽度，向右拖动减少宽度。
      const delta = startXRef.current - e.clientX
      const nextWidth = Math.max(200, Math.min(800, startWidthRef.current + delta))
      setWidth(nextWidth)
    }

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return { width, onMouseDown, setWidth }
}
