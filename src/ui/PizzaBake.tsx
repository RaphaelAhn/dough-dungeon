import { useCallback, useEffect, useRef, useState } from 'react'
import { fullName } from '../core/codex'
import type { Run } from '../core/run'
import PizzaArt, { toppingRevealMs } from './PizzaArt'
import { play } from './sound'
import './PizzaBake.css'

/**
 * 피자 완성 연출 — 보스를 잡아 소스를 얻은 바로 다음, 결과 화면 전에 낀다.
 *
 * 전에는 재료가 전투 내내 도우 위에 그대로 쌓였다. 실제 피자는 소스 →
 * 토핑 → 치즈 순인데, 소스도 없는 맨 반죽에 재료부터 올라가 있으니
 * 순서가 거꾸로 보였다. 그래서 도우가 재료를 실시간으로 보여 주는 것을
 * 그만두고(Battle.tsx, Recruit.tsx), 그 대신 여기서 한 번에 — 넓게 편 도우 →
 * 소스 → 토핑 → 치즈 → 화덕 → 완성 — 순서대로 보여 준다.
 */

type Stage = 'spread' | 'sauce' | 'toppings' | 'cheese' | 'oven' | 'baking' | 'done'

const STAGE_ORDER: Stage[] = ['spread', 'sauce', 'toppings', 'cheese', 'oven', 'baking', 'done']

const CAPTION: Record<Stage, string> = {
  spread: '반죽을 넓게 편다',
  sauce: '소스를 바른다',
  toppings: '토핑을 골고루 뿌린다',
  cheese: '치즈를 듬뿍 올린다',
  oven: '오래된 화덕에 넣는다',
  baking: '굽는 중…',
  done: '완성',
}

/** 각 구간이 걸리는 시간(ms). 재료를 뿌리는 구간만 재료 수에 따라 늘어난다. */
const SPREAD_MS = 650
const SAUCE_MS = 700
const TOPPING_STAGGER_MS = 130
const TOPPING_TAIL_MS = 450
const CHEESE_MS = 650
const OVEN_ENTER_MS = 700
/** ⚠ 화덕 안에 머무는 시간. 요청대로 2초 고정이다. */
const BAKE_MS = 2000
/** 완성된 모습을 얼마나 붙들고 있을지 — 안 눌러도 저절로 다음으로 간다 */
const REVEAL_HOLD_MS = 1700

export default function PizzaBake({ run, onDone }: { run: Run; onDone: () => void }) {
  const pizza = run.pizza
  const solids = run.toppings.filter((t) => t.kind !== 'sauce')

  const [stage, setStage] = useState<Stage>('spread')
  const timersRef = useRef<number[]>([])

  /*
   * 전체 순서를 한 번에 예약한다. 도중에 상태가 바뀌어 다시 실행될 이유가
   * 없는 고정된 시퀀스라 마운트 시 한 번만 돈다.
   */
  useEffect(() => {
    const events: { at: number; fn: () => void }[] = []
    let t = 0

    t += SPREAD_MS
    events.push({ at: t, fn: () => { setStage('sauce'); play('place') } })
    t += SAUCE_MS
    events.push({ at: t, fn: () => setStage('toppings') })
    solids.forEach((_, i) => {
      events.push({ at: t + i * TOPPING_STAGGER_MS, fn: () => play('place') })
    })
    // 재료 종류(소리 타이밍)뿐 아니라, 그 뒤로 판을 채우는 조각들까지 다 뿌려질 시간을 잡는다.
    t += Math.max(TOPPING_TAIL_MS, toppingRevealMs(solids.length, TOPPING_STAGGER_MS) + TOPPING_TAIL_MS)
    events.push({ at: t, fn: () => { setStage('cheese'); play('card') } })
    t += CHEESE_MS
    events.push({ at: t, fn: () => { setStage('oven'); play('bake') } })
    t += OVEN_ENTER_MS
    events.push({ at: t, fn: () => setStage('baking') })
    t += BAKE_MS
    events.push({ at: t, fn: () => { setStage('done'); play('tada') } })

    timersRef.current = events.map((e) => window.setTimeout(e.fn, e.at))
    return () => timersRef.current.forEach(window.clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 완성된 뒤엔 안 눌러도 저절로 결과 화면으로 넘어간다
  useEffect(() => {
    if (stage !== 'done') return
    const t = window.setTimeout(onDone, REVEAL_HOLD_MS)
    return () => window.clearTimeout(t)
  }, [stage, onDone])

  /** 누르면 건너뛴다 — 이미 완성된 뒤라면 곧장 결과 화면으로. */
  const advance = useCallback(() => {
    if (stage === 'done') {
      onDone()
      return
    }
    timersRef.current.forEach(window.clearTimeout)
    setStage('done')
    play('tada')
  }, [stage, onDone])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        advance()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [advance])

  const idx = STAGE_ORDER.indexOf(stage)
  const showSauce = idx >= STAGE_ORDER.indexOf('sauce')
  const showToppings = idx >= STAGE_ORDER.indexOf('toppings')
  const showCheese = idx >= STAGE_ORDER.indexOf('cheese')
  const inOven = stage === 'oven' || stage === 'baking'
  const baked = stage === 'done'

  return (
    <div className={`pb pb--${stage}`} onClick={advance} role="button" tabIndex={0}>
      <p className="pb__caption">{CAPTION[stage]}</p>

      <div className="pb__scene">
        <div className={`pb__pizza${inOven ? ' is-in-oven' : ''}`}>
          <PizzaArt
            toppings={run.toppings}
            baked={baked}
            size={240}
            showSauce={showSauce}
            showToppings={showToppings}
            showCheese={showCheese}
            staggerMs={TOPPING_STAGGER_MS}
          />
        </div>

        <div className={`pb__oven${idx >= STAGE_ORDER.indexOf('oven') ? ' is-on' : ''}`} aria-hidden="true">
          <span className="pb__oven-glow" />
          {stage === 'baking' &&
            Array.from({ length: 5 }, (_, i) => (
              <i key={i} className="pb__ember" style={{ left: `${30 + i * 10}%`, animationDelay: `${i * 0.3}s` }} />
            ))}
        </div>
      </div>

      <p className="pb__name">{baked && pizza ? fullName(pizza, run.toppings) : ' '}</p>

      <p className="pb__hint">클릭 · Enter</p>
    </div>
  )
}
