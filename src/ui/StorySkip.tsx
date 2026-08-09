import { useEffect, useState } from 'react'
import { play } from './sound'
import './StorySkip.css'

/**
 * 스토리 스킵 여부 — 직전 판을 끝까지 본 사람에게만 묻는다(App.tsx hasPlayed).
 *
 * 검은 화면에 흰 글자 하나. 이야기를 다시 트는 화면(Prologue)도, 이야기를
 * 건너뛰고 곧장 들어가는 화면(DiceRoll)도 둘 다 이 화면 다음이라 — 여기
 * 자체는 어느 쪽 색도 입지 않은 중립적인 물음표 자리다.
 */
export default function StorySkip({
  onSkip,
  onPlay,
}: {
  /** 네 — 이야기를 건너뛰고 도우 숙성부터 시작한다 */
  onSkip: () => void
  /** 아니오 — 이야기를 처음부터 다시 튼다 */
  onPlay: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const choices = [
    { label: '네', run: onSkip },
    { label: '아니오', run: onPlay },
  ]

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        setCursor((c) => (c + 1) % choices.length)
        play('move')
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        play('select')
        choices[cursor].run()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor])

  return (
    <div className="ss">
      <p className="ss__q">스토리를 스킵하시겠습니까?</p>
      <div className="ss__choices">
        {choices.map((c, i) => (
          <button
            key={c.label}
            type="button"
            className={`ss__btn${i === cursor ? ' is-on' : ''}`}
            onMouseEnter={() => {
              if (i !== cursor) play('move')
              setCursor(i)
            }}
            onClick={() => {
              play('select')
              c.run()
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
      <p className="ss__hint">←→ 선택 · Enter 결정</p>
    </div>
  )
}
