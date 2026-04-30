import { useCallback, useRef } from 'react'

/**
 * Enables frameless-window dragging by sending pointer delta to the main process.
 * Attach the returned `onPointerDown` to any element that should act as the drag handle.
 */
export function useDrag() {
  const lastPos = useRef<{ x: number; y: number } | null>(null)
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    // Only drag on primary button; ignore right-click / touch that shouldn't drag
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    lastPos.current = { x: e.screenX, y: e.screenY }
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!dragging.current || !lastPos.current) return
    const deltaX = e.screenX - lastPos.current.x
    const deltaY = e.screenY - lastPos.current.y
    lastPos.current = { x: e.screenX, y: e.screenY }

    if (window.electronAPI) {
      window.electronAPI.dragWindow(deltaX, deltaY)
    }
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
    lastPos.current = null
  }, [])

  return { onPointerDown, onPointerMove, onPointerUp }
}
