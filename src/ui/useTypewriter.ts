import { useEffect, useRef, useState } from 'react'

/** 한 글자당 시간(ms). 짧으면 타자기 맛이 안 나고, 길면 읽는 사람이 답답하다. */
const STEP_MS = 32

/**
 * 문자열을 한 글자씩 드러낸다.
 *
 * text 가 바뀌면(다음 대사로 넘어가면) 처음부터 다시 잰다. skip() 을 부르면
 * 그 자리에서 전부 드러난다 — 클릭·Enter 로 건너뛸 때 쓴다.
 *
 * 애니메이션을 줄이도록 설정한 사용자에게는 처음부터 완성된 문장을 보여 준다.
 */
export function useTypewriter(text: string): { display: string; done: boolean; skip: () => void } {
  const [count, setCount] = useState(0)
  const reduced = useRef(
    typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  )

  useEffect(() => {
    if (reduced.current) {
      setCount(text.length)
      return
    }
    setCount(0)
    if (text.length === 0) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setCount(i)
      if (i >= text.length) window.clearInterval(id)
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [text])

  return {
    display: text.slice(0, count),
    done: count >= text.length,
    skip: () => setCount(text.length),
  }
}
