import { useCallback, useEffect, useRef, useState } from 'react'
import { PORTIONS, pickPortion, portionOf, type Portion } from '../core/divide'
import { STAT_LABEL, type Stats } from '../core/character'
import CharacterSprite from './CharacterSprite'
import { play } from './sound'
import './Divide.css'

/**
 * 분할 — 숙성이 끝난 반죽을 피자 한 판 크기로 떼어낸다. 판의 시작이다.
 *
 * 고르지 않고 잰다. 전자 저울에 반죽을 올리면 숫자가 어지럽게 튀다가
 * 한 곳에 멎는다 — 실제로도 큰 반죽에서 한 덩이를 떼면 딱 떨어지지 않고
 * 저울에 올려 봐야 몇 그램인지 안다.
 *
 * 그래서 네 크기가 서로 값어치가 비슷해야 한다. 고를 수 없는 것에 우열이
 * 있으면 뽑기가 곧 벌칙이 된다. 토핑 자리는 그 자체로 이득이므로 보정이
 * 작은 쪽을 받치고 큰 쪽을 누른다. (divide.ts)
 */

/** 저울이 요동치는 시간 ⚠ 짧으면 싱겁고 길면 지루하다 */
const WEIGH_MS = 2400
/**
 * 이 지점(0~1)부터 숫자가 정답으로 미끄러진다. 그 전까지는 어지럽게 튄다.
 * 실제 저울도 이런 식이다 — 처음엔 안정 안 된 숫자가 마구 바뀌다가,
 * 뒤로 갈수록 진짜 무게 근처로 좁혀지며 멎는다.
 */
const SETTLE_AT = 0.68
/** 숫자가 튀는 소리의 최소 간격(ms). 프레임마다 내면 잡음이 된다 */
const TICK_MS = 70

export default function Divide({
  name,
  onDone,
}: {
  name: string
  onDone: (portion: Portion) => void
}) {
  const [display, setDisplay] = useState(0)
  const [phase, setPhase] = useState<'ready' | 'weighing' | 'done'>('ready')
  const [result, setResult] = useState<Portion | null>(null)
  const raf = useRef(0)
  const weighed = useRef(false)
  // 튀는 동안의 마지막 숫자. 정답으로 미끄러지기 시작할 때 여기서부터 잇는다.
  const lastScramble = useRef(0)
  const settleFrom = useRef<number | null>(null)
  const lastTickAt = useRef(0)

  const weigh = useCallback(() => {
    if (weighed.current) return
    weighed.current = true
    setPhase('weighing')
    settleFrom.current = null

    const target = pickPortion()
    const targetGrams = portionOf(target).grams

    const started = Date.now()
    const loop = () => {
      const t = Math.min(1, (Date.now() - started) / WEIGH_MS)
      let shown: number

      if (t < SETTLE_AT) {
        /*
         * 튀는 폭이 앞에서는 넓고(±240g) 뒤로 갈수록 좁아진다(±40g) —
         * 저울이 흔들리다 점점 진정되는 모양이다.
         */
        const spread = 240 * (1 - t / SETTLE_AT) + 40
        shown = Math.round(targetGrams + (Math.random() * 2 - 1) * spread)
        shown = Math.max(150, Math.min(600, shown))
        lastScramble.current = shown
      } else {
        if (settleFrom.current === null) settleFrom.current = lastScramble.current
        const u = (t - SETTLE_AT) / (1 - SETTLE_AT)
        const eased = 1 - Math.pow(1 - u, 3)
        shown = Math.round(settleFrom.current + (targetGrams - settleFrom.current) * eased)
      }
      setDisplay(shown)

      const now = Date.now()
      if (now - lastTickAt.current > TICK_MS) {
        lastTickAt.current = now
        if (t < 0.97) play('tick')
      }

      if (t >= 1) {
        setDisplay(targetGrams)
        setResult(target)
        setPhase('done')
        play('select')
        return
      }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
  }, [])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (phase === 'ready') weigh()
      else if (phase === 'done' && result) onDone(result)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, result, weigh, onDone])

  const got = result ? portionOf(result) : null

  return (
    <div className="dv">
      <header className="dv__head">
        <h2>반죽 분할</h2>
        <p>
          {got ? (
            <>
              <b>{got.label}</b> 사이즈를 떼어냈습니다. {got.grams}g 짜리 반죽입니다.
            </>
          ) : (
            <>큰 반죽에서 한 판 크기를 떼어냅니다. 판이 클수록 토핑이 늘어납니다.</>
          )}
        </p>
      </header>

      <div className="dv__stage">
        <div className="dv__scale">
          <div className={`dv__plate${phase === 'weighing' ? ' is-weighing' : ''}`}>
            <CharacterSprite scale={0.7} />
          </div>
          <b className="dv__name">{name}</b>
          <div className="dv__body">
            <div
              className={`dv__screen${phase === 'done' ? ' is-done' : ''}`}
              role="img"
              aria-label={got ? `${got.label} 사이즈 ${got.grams}그램` : '전자 저울'}
            >
              <span className="dv__screen-num">{display}</span>
              <span className="dv__screen-unit">g</span>
            </div>
          </div>
        </div>
      </div>

      {/* 어느 크기가 무엇을 주는지 재기 전부터 보인다. 몰라서 놀라는 것과 알고 기다리는 것은 다르다. */}
      <div className="dv__table">
        {PORTIONS.map((p) => (
          <div key={p.id} className={`dv__row${result === p.id ? ' is-won' : ''}`}>
            <b className="dv__row-label">{p.label}</b>
            <span className="dv__row-grams">{p.grams}g</span>
            <span className="dv__row-slot">
              토핑 <b>{p.slots}</b>
            </span>
            <Diff gain={p.gain} />
          </div>
        ))}
      </div>

      <p className="dv__desc">{got ? got.desc : ' '}</p>

      <footer className="dv__foot">
        {phase === 'done' && result ? (
          <button className="dv__go" onClick={() => onDone(result)}>
            둥글리기로 →
          </button>
        ) : (
          <button className="dv__go" onClick={weigh} disabled={phase === 'weighing'}>
            {phase === 'weighing' ? '재는 중…' : '반죽 떼어내기'}
          </button>
        )}
        <p className="dv__hint">Enter / Space</p>
      </footer>
    </div>
  )
}

function Diff({ gain }: { gain: Partial<Stats> }) {
  const keys = (Object.keys(gain) as (keyof Stats)[]).filter((k) => gain[k])
  return (
    <span className="dv__diff">
      {keys.map((k) => (
        <em key={k} className={(gain[k] ?? 0) > 0 ? 'is-up' : 'is-down'}>
          {STAT_LABEL[k]} {(gain[k] ?? 0) > 0 ? `+${gain[k]}` : gain[k]}
        </em>
      ))}
    </span>
  )
}
