import { useEffect, useState } from 'react'
import { play } from './sound'
import { useTypewriter } from './useTypewriter'
import './Prologue.css'

/**
 * 프롤로그 — 밀이 도우가 되기까지.
 *
 * 타이틀에서 "게임 시작"을 누르면 도우 빚기(CharacterCreate) 전에 이 장면이
 * 낀다. 밀밭 → 콤바인이 다가와 정신이 아뜩해진다 → 캄캄한 데서 반죽이
 * 되어 간다, 세 박자다. 재료(물·소금·이스트·올리브오일)를 이름으로 말하지
 * 않고 밀의 몸이 느끼는 감각으로만 말한다 — 술 냄새(이스트 발효)·눅눅함(물)·
 * 까칠함(소금)·미끌거림(올리브오일).
 *
 * 매번 "게임 시작"을 누를 때마다 다시 나온다 — 반복 재생이 전제라, 클릭·
 * Enter 한 번으로 타자기를 건너뛰고 한 번 더 누르면 다음 대사로 가게 해
 * 두 번째부터는 빠르게 훑을 수 있다.
 */

const FIELD_LINE = '이제 때가 됐구나 난 뭘가 될까'

/*
 * 대사는 원문 그대로다. 문장 안의 줄바꿈(\n)도 원문의 문단 구분을 그대로
 * 옮긴 것이다. 재료 등장 순서 — 이스트(취한다) → 물(눅눅) → 소금(까칠) →
 * 올리브오일(미끌) — 는 밀, 물, 소금, 이스트, 올리브오일 순으로 받은 재료
 * 목록과 다르다. 실제 반죽 순서(이스트를 물에 풀고 → 소금을 넣고 → 마지막에
 * 오일)를 따른 것이라 손대지 않는다.
 */
const DARK_BEATS = [
  '뭐야 이 소리 뭐야!!!!!!!!!!!!! 아!!!!!!!!!!!!!\n아무것도 안보여!!!',
  '어디서 은은하게 술냄새도 나는데? 어 나 취한다 으악',
  '뭐지 이 눅진느낌은? 난 그냥 하나의 밀인데 왜 눅눅하지?\n이 까칠까칠한건 또 뭐지 나한테 오지마!!!!!!!!!!',
  '왜 미끌거리는거지? 나 진짜 취한건가 아 졸리다...',
  '그렇게 나는 하나의 뽀얀 덩어리가 되었다 난 뭐가 되는 것일까?',
]

/** 스포트라이트가 들어오기까지. 장면이 뜨자마자 대사부터 튀어나오면 안 붙는다 */
const SPOTLIGHT_DELAY_MS = 550
/** 콤바인이 다가와 화면이 흔들리는 시간. harvest 소리 길이(1.9s)에 맞춘다 */
const HARVEST_MS = 1900
/** 마지막 대사를 다 본 뒤 도우 빚기로 넘어가며 화면이 지워지는 시간 */
const LEAVE_MS = 300

/**
 * 마지막 어둠 대사 뒤 — 밀이 도우로 불리는 순간.
 *
 * 여기부터는 클릭으로 넘기지 않는다. 코미디 타이밍이라 사람이 누르는
 * 순간 박자가 흐트러진다 — 자동으로 흘러가게 두고 사람은 보기만 한다.
 * 'shout' 은 화면 가운데 크게 뜨는, 알아들을 수 없는(자막으로만 뜻이
 * 전해지는) 목소리다. 'line' 은 기존 대사 상자와 같은 자리에, 도우 자신이
 * 또렷하게 하는 말이다.
 */
type RevealStep =
  | { kind: 'shout'; text: string; sound: 'gibberish' | 'gibberish2' | 'tada'; holdMs: number }
  | { kind: 'line'; text: string; holdMs: number }

const REVEAL_STEPS: RevealStep[] = [
  { kind: 'shout', text: '막내야!!! 도우는!!!', sound: 'gibberish', holdMs: 900 },
  { kind: 'line', text: '난 밀인데? 내가 도우야?', holdMs: 1200 },
  { kind: 'shout', text: '네!!! 쉐프!!!!!!!', sound: 'tada', holdMs: 800 },
  { kind: 'shout', text: '!@#!@$ 피자 주문 들어왔습니다!!!', sound: 'gibberish2', holdMs: 800 },
]
/** 대사 사이 정적. 슝 하고 다음 게 뜨면 안 붙는다 */
const REVEAL_GAP_MS = 500
/** 이름이 밀→도우로 바뀌는 자리. 첫 shout(막내야! 도우는!)이 끝난 직후다 */
const RENAME_AFTER_STEP = 0

type Phase = 'field' | 'harvest' | 'dark' | 'reveal'

/*
 * 배경의 밀 백열 포기. 결과 화면의 색종이(Result.tsx Confetti)와 같은 방식 —
 * 고정 시드로 흩어 둔다. 매번 같은 자리에 서 있어도 한 판에 한 번 보는
 * 장면이라 티가 안 난다. 대신 자리가 프레임마다 바뀌면 그게 더 눈에 띈다.
 *
 * 처음엔 스물두 포기였는데 화면에 비해 휑했다. 다섯 배로 늘리면서
 * depth(0=멀리, 1=가까이) 를 하나 더 둬 밭에 깊이를 준다 — 먼 포기는
 * 위쪽(ground 안에서 bottom 값을 키움)에 작고 흐리게, 가까운 포기는
 * 아래쪽에 크고 진하게 선다. 다 같은 크기로 뿌리면 줄지어 선 것처럼
 * 납작해 보인다.
 */
const STALKS = Array.from({ length: 110 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  const depth = r(8)
  return {
    left: r(1) * 100,
    bottom: depth * 34,
    h: 20 + (1 - depth) * 46,
    tilt: (r(4) - 0.5) * 10,
    delay: r(5) * 3,
    dur: 2.6 + r(6) * 1.6,
    lit: r(7) > 0.72,
    dim: depth < 0.35,
  }
})

function Wheat({ tall, lit }: { tall?: boolean; lit?: boolean }) {
  return (
    <svg viewBox="0 0 14 44" className={`pl__stalk-art${lit ? ' is-lit' : ''}`} aria-hidden="true">
      <line x1="7" y1="44" x2="7" y2="14" stroke="var(--pl-stem)" strokeWidth="1.6" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i}>
          <line
            x1="7" y1={12 - i * 2.6} x2={i % 2 === 0 ? 1.5 : 12.5} y2={9 - i * 2.6}
            stroke="var(--pl-awn)" strokeWidth="1"
          />
        </g>
      ))}
      <ellipse cx="7" cy="7" rx="4" ry={tall ? 8 : 6.5} fill="var(--pl-head)" />
    </svg>
  )
}

function WheatField({ spotlightOn }: { spotlightOn: boolean }) {
  return (
    <div className="pl__field">
      <div className="pl__sky">
        <span className="pl__sun" />
      </div>
      <div className="pl__ground">
        {STALKS.map((s, i) => (
          <span
            key={i}
            className={`pl__stalk${s.dim ? ' is-far' : ''}`}
            style={{
              left: `${s.left}%`,
              bottom: `${s.bottom}%`,
              height: `${s.h}px`,
              rotate: `${s.tilt}deg`,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.dur}s`,
            }}
          >
            <Wheat lit={s.lit} />
          </span>
        ))}
        {/*
          주인공 밀. 스포트라이트가 켜지면 확대되며 밝아지고, 둘레는
          어두워진다(.pl__vignette) — 시선이 여기 하나로 좁혀진다.
        */}
        <span className={`pl__hero${spotlightOn ? ' is-on' : ''}`}>
          <Wheat tall lit />
        </span>
      </div>
      <span className={`pl__vignette${spotlightOn ? ' is-on' : ''}`} aria-hidden="true" />
    </div>
  )
}

export default function Prologue({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('field')
  const [spotlightOn, setSpotlightOn] = useState(false)
  const [beat, setBeat] = useState(0)
  const [leaving, setLeaving] = useState(false)
  // reveal 단계 진행. speakerName 은 '막내야! 도우는!' 이 끝나는 순간 밀→도우로 바뀐다.
  const [revealIndex, setRevealIndex] = useState(0)
  const [revealVisible, setRevealVisible] = useState(false)
  const [speakerName, setSpeakerName] = useState('밀')

  useEffect(() => {
    const t = window.setTimeout(() => setSpotlightOn(true), SPOTLIGHT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (phase !== 'harvest') return
    play('harvest')
    const t = window.setTimeout(() => setPhase('dark'), HARVEST_MS)
    return () => window.clearTimeout(t)
  }, [phase])

  /*
   * reveal 은 사람이 넘기지 않는다. 한 스텝을 보여 주고(holdMs), 감춘 뒤
   * 정적(REVEAL_GAP_MS)을 두고 다음으로 간다 — 코미디 박자를 클릭이 흔들면
   * 안 된다.
   */
  useEffect(() => {
    if (phase !== 'reveal') return
    const step = REVEAL_STEPS[revealIndex]
    if (step.kind === 'shout') play(step.sound)
    setRevealVisible(true)
    const hideT = window.setTimeout(() => setRevealVisible(false), step.holdMs)
    const nextT = window.setTimeout(() => {
      if (revealIndex === RENAME_AFTER_STEP) setSpeakerName('도우')
      if (revealIndex < REVEAL_STEPS.length - 1) {
        setRevealIndex((i) => i + 1)
      } else {
        setLeaving(true)
        window.setTimeout(onDone, LEAVE_MS)
      }
    }, step.holdMs + REVEAL_GAP_MS)
    return () => {
      window.clearTimeout(hideT)
      window.clearTimeout(nextT)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, revealIndex])

  const lineText =
    phase === 'field' ? (spotlightOn ? FIELD_LINE : '') : phase === 'dark' ? DARK_BEATS[beat] : ''
  const { display, done, skip } = useTypewriter(lineText)

  const advance = () => {
    if (leaving) return
    if (phase === 'field') {
      if (!spotlightOn) return
      if (!done) return skip()
      setPhase('harvest')
      return
    }
    if (phase === 'harvest') return // 흔들리는 동안은 자동으로만 넘어간다
    if (phase === 'reveal') return // 여기부터는 자동으로만 넘어간다
    // phase === 'dark'
    if (!done) return skip()
    if (beat < DARK_BEATS.length - 1) {
      play('tick')
      setBeat((b) => b + 1)
      return
    }
    setPhase('reveal')
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
  }, [phase, spotlightOn, done, beat, leaving])

  const revealStep = phase === 'reveal' ? REVEAL_STEPS[revealIndex] : null

  return (
    <div
      className={`pl pl--${phase === 'reveal' ? 'dark' : phase}${leaving ? ' is-leaving' : ''}`}
      onClick={advance}
      role="button"
      tabIndex={0}
    >
      {phase !== 'dark' && phase !== 'reveal' ? (
        <WheatField spotlightOn={spotlightOn} />
      ) : (
        <div className="pl__dark">
          <span className="pl__glow" aria-hidden="true" />
        </div>
      )}

      {lineText && (
        <div className="pl__box">
          <b className="pl__name">밀</b>
          <p className="pl__text">
            {display.split('\n').map((ln, i, arr) => (
              <span key={i}>
                {ln}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
            {!done && <i className="pl__cursor" aria-hidden="true" />}
          </p>
          {done && <p className="pl__hint">클릭 · Enter</p>}
        </div>
      )}

      {revealStep?.kind === 'line' && (
        <div className={`pl__box${revealVisible ? ' is-on' : ' is-off'}`}>
          <b className="pl__name">{speakerName}</b>
          <p className="pl__text">{revealStep.text}</p>
        </div>
      )}

      {revealStep?.kind === 'shout' && (
        <div className={`pl__shout${revealVisible ? ' is-on' : ''}`} aria-hidden="true">
          {revealStep.text}
        </div>
      )}
    </div>
  )
}
