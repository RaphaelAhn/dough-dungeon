import { useEffect, useRef, useState } from 'react'
import { BASE_STATS, STAT_META, type Stats } from '../core/character'
import { applyFace, DICE, rollDice, type Face } from '../core/dice'
import CharacterSprite from './CharacterSprite'
import { play } from './sound'
import Ferment from './Ferment'
import './DiceRoll.css'

/** 굴러가는 연출 길이. 짧으면 싱겁고 길면 지루하다. */
const ROLL_MS = 1400
/** 굴리는 동안 눈이 바뀌는 간격 */
const TICK_MS = 70

/*
 * 숙성이 끝나는 순간의 소리 순서.
 *
 * 전자레인지를 흉내낸다 — 도는 동안 남은 시간을 세다가, 다 되면 땡 하고,
 * 두구두구 끌다가, 결과가 나온다. 소리만 겹쳐 놓으면 다 됐다는 신호와
 * 결과 발표가 한 덩어리로 들려서 뜸이 안 생긴다.
 *
 * 그래서 화면도 같이 미룬다. 땡 소리가 나는데 값이 이미 떠 있으면
 * 두구두구가 아무것도 안 기다리는 북이 된다.
 */
const BEEP_MS = 340
/*
 * 북은 0.62초 만에 잦아든다(파형 실측). 900 으로 잡았더니 북이 끝나고
 * 발표까지 260ms 가 비어, 뜸이 아니라 끊긴 것처럼 들렸다.
 * 북의 마지막 타에 팡파레가 얹히도록 맞춘다.
 */
const DRUM_MS = 640

/*
 * 'waiting' 은 다 익었지만 결과를 아직 안 보여 주는 사이다.
 * 땡 소리와 북소리가 흐르는 동안이며, 이 틈이 없으면 두구두구가
 * 아무것도 안 기다리는 북이 된다.
 */
type Phase = 'ready' | 'rolling' | 'waiting' | 'done'

export default function DiceRoll({
  name,
  onStart,
}: {
  name: string
  onStart: (face: Face) => void
}) {
  const [phase, setPhase] = useState<Phase>('ready')
  // 숙성 중 흔들릴 계기 값. 멈추면 결과의 조건으로 고정된다.
  const [gauge, setGauge] = useState({ temp: 4, ferment: 0 })
  const [result, setResult] = useState<Face | null>(null)
  // 리롤 불가가 이 게임의 규칙이다. 연타나 키 중복 입력으로도 두 번 굴러선 안 된다.
  const rolled = useRef(false)
  const timers = useRef<number[]>([])

  // 굴리는 도중 화면을 벗어나도 타이머가 남지 않게 정리한다.
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const roll = () => {
    if (rolled.current) return
    rolled.current = true
    setPhase('rolling')

    const settled = rollDice()
    const started = Date.now()
    // 숙성도는 0 에서 결과값까지 차오르고, 온도는 끝까지 흔들린다.
    const spin = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / ROLL_MS)
      setGauge({
        temp: Math.round(-1 + Math.random() * 12),
        ferment: Math.round(t * DICE[settled].ferment),
      })
    }, TICK_MS)

    // 숫자가 바뀌는 속도(70ms)로 소리를 내면 지글거린다. 세는 소리는 따로 둔다.
    // setInterval 은 첫 박을 건너뛴다. 누르자마자 세기 시작해야 한다.
    play('beep')
    const counting = setInterval(() => play('beep'), BEEP_MS)

    const stop = setTimeout(() => {
      clearInterval(spin)
      clearInterval(counting)
      // 게이지는 여기서 멈춘다 — 다 익었다는 것까지만 알린다
      setGauge({ temp: DICE[settled].temp, ferment: DICE[settled].ferment })
      setPhase('waiting')
      play('ding')
      // 땡 여운이 반쯤 남았을 때 북이 들어와야 끊긴 느낌이 안 난다
      const drum = setTimeout(() => play('drumroll'), 420)
      const reveal = setTimeout(() => {
        setResult(settled)
        setPhase('done')
        play('tada')
      }, 420 + DRUM_MS)
      timers.current.push(drum, reveal)
    }, ROLL_MS)
    timers.current.push(spin, counting, stop)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return
      e.preventDefault()
      if (phase === 'ready') roll()
      else if (phase === 'done' && result) onStart(result)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase, result, onStart])

  const rolledFace = result ? DICE[result] : null
  const stats = result ? applyFace(result) : BASE_STATS

  return (
    <div className={`dr dr--${phase}`}>
      <header className="dr__head">
        <h2>{phase === 'done' ? '도우 숙성 완료' : '도우 숙성'}</h2>
        <p>
          {phase === 'done' ? (
            <>
              이 반죽을 <b>한 판 크기</b>로 나눕니다.
            </>
          ) : (
            <>
              숙성은 <b>단 한 번</b>뿐입니다. 다시 할 수 없습니다.
            </>
          )}
        </p>
      </header>

      <div className="dr__stage">
        <div className="dr__char">
          <CharacterSprite scale={0.8} />
          <b className="dr__char-name">{name}</b>
        </div>

        <Ferment temp={gauge.temp} ferment={gauge.ferment} rolling={phase === 'rolling'} />
      </div>

      <section className="dr__result" aria-live="polite">
        {phase === 'ready' && (
          <p className="dr__wait">숙성을 시작해 이 도우의 시작 능력을 정하세요.</p>
        )}
        {phase === 'rolling' && <p className="dr__wait">숙성 중…</p>}
        {phase === 'waiting' && <p className="dr__wait dr__wait--done">발효가 완료되었습니다.</p>}
        {phase === 'done' && rolledFace && (
          <>
            <div className="dr__card">
              <span className="dr__style">{rolledFace.favors}</span>
              <h3 className="dr__name">{rolledFace.name}</h3>
              <p className="dr__desc">{rolledFace.desc}</p>
            </div>
            <StatDiff before={BASE_STATS} after={stats} />
          </>
        )}
      </section>

      <footer className="dr__foot">
        {phase !== 'done' ? (
          <button className="dr__btn" onClick={roll} disabled={phase !== 'ready'}>
            {phase === 'ready' ? '도우 숙성 시작' : '숙성 중…'}
          </button>
        ) : (
          <button className="dr__btn dr__btn--go" onClick={() => result && onStart(result)}>
            반죽 분할하기 →
          </button>
        )}
        <p className="dr__hint">Enter / Space</p>
      </footer>
    </div>
  )
}

/** 주사위가 실제로 무엇을 바꿨는지 눈으로 보여준다. 6번 눈은 증감이 전부 0이다. */
function StatDiff({ before, after }: { before: Stats; after: Stats }) {
  return (
    <ul className="dr__stats">
      {STAT_META.map((s) => {
        const diff = after[s.key] - before[s.key]
        return (
          <li key={s.key} className={diff > 0 ? 'is-up' : ''}>
            <span className="dr__stat-label">{s.label}</span>
            <span className="dr__stat-value">{after[s.key]}</span>
            <span className="dr__stat-diff">{diff > 0 ? `+${diff}` : ''}</span>
          </li>
        )
      })}
    </ul>
  )
}
