import { useEffect, useState } from 'react'
import { play } from './sound'
import { useTypewriter } from './useTypewriter'
import './KitchenCall.css'

/**
 * 성형이 끝난 뒤, 전투로 들어가기 전 한 박자.
 *
 * 도우가 자신의 앞날을 되새기는 한 줄(클릭으로 넘긴다) 다음, 주방에서
 * 못 알아듣는 목소리가 재촉한다(자동으로 떴다 사라진다) — Prologue 의
 * reveal 단계와 같은 자리다.
 */

const LINE = '그럼 나는 피자가 되는건가... 먹는건가? 그럼 난 세계 최고의 근본 피자가 될거야!!'
const SHOUT = '피자 빨리 준비할게요!!!!'
const SHOUT_HOLD_MS = 900
const LEAVE_MS = 300

export default function KitchenCall({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<'line' | 'shout' | 'leave'>('line')
  const [shoutOn, setShoutOn] = useState(false)
  const { display, done, skip } = useTypewriter(phase === 'line' ? LINE : '')

  useEffect(() => {
    if (phase !== 'shout') return
    play('gibberish2')
    setShoutOn(true)
    const hideT = window.setTimeout(() => setShoutOn(false), SHOUT_HOLD_MS)
    const leaveT = window.setTimeout(() => {
      setPhase('leave')
      window.setTimeout(onDone, LEAVE_MS)
    }, SHOUT_HOLD_MS + 400)
    return () => {
      window.clearTimeout(hideT)
      window.clearTimeout(leaveT)
    }
  }, [phase, onDone])

  const advance = () => {
    if (phase !== 'line') return
    if (!done) return skip()
    setPhase('shout')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, done])

  return (
    <div
      className={`kc${phase === 'leave' ? ' is-leaving' : ''}`}
      onClick={advance}
      role="button"
      tabIndex={0}
    >
      <span className="kc__glow" aria-hidden="true" />

      {phase === 'line' && (
        <div className="kc__box">
          <b className="kc__name">도우</b>
          <p className="kc__text">
            {display}
            {!done && <i className="kc__cursor" aria-hidden="true" />}
          </p>
          {done && <p className="kc__hint">클릭 · Enter</p>}
        </div>
      )}

      {phase !== 'line' && (
        <div className={`kc__shout${shoutOn ? ' is-on' : ''}`} aria-hidden="true">
          {SHOUT}
        </div>
      )}
    </div>
  )
}
