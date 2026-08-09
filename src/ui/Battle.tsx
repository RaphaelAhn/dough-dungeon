import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react'
import {
  enemyAct,
  endTurn,
  playerAct,
  playerFirst,
  startBattle,
  tick,
  type BattleState,
  type Command,
  type Unit,
} from '../core/battle'
import type { Encounter } from '../core/enemy'
import { STAT_SHORT } from '../core/character'
import { FINAL_STAGE, maxMp, type Run } from '../core/run'
import { describeSkill, SKILLS, skillsOfTaste } from '../core/skill'
import { TASTE_LABEL } from '../core/topping'
import { formatClock, stageLimitMs, TURN_LIMIT_MS } from '../core/timer'
import CharacterSprite, { type Mood } from './CharacterSprite'
import FormArt from './FormArt'
import { play } from './sound'
import './Battle.css'

/** 한 조각을 보여 주는 시간 ⚠ 짧으면 못 읽고 길면 답답하다 */
const STEP_MS = 1000

/**
 * 도우 그림 배율. 화면이 낮으면 줄인다.
 *
 * 전장 칸은 남는 자리를 받아 쓰는데, 그림은 px 로 고정이라 자리가 모자라면
 * 줄지 않고 아래 로그 위로 흘러넘쳤다 — 기술 일곱 개를 펼친 보스전에서
 * 도우 정보 상자가 로그를 덮었다. 여백을 다 걷고도 모자라면 그림이 물러난다.
 */
function scaleFor(h: number): number {
  return h < 660 ? 0.54 : h < 780 ? 0.63 : 0.72
}

function useDoughScale(): number {
  const [scale, setScale] = useState(() => scaleFor(window.innerHeight))
  useEffect(() => {
    const onResize = () => setScale(scaleFor(window.innerHeight))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return scale
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const STATUS_LABEL: Record<string, string> = {
  burn: '눌음',
  stun: '굳음',
  slow: '처짐',
  atkDown: '식음',
  guard: '방어',
}

export default function Battle({
  run,
  enc,
  onWin,
  onEnd,
}: {
  run: Run
  enc: Encounter
  /** 승리 — 전투 결과가 반영된 런을 돌려준다 */
  onWin: (next: Run) => void
  /** 규칙 1(시간 초과) 또는 규칙 2(사망) */
  onEnd: (reason: 'lose' | 'timeout') => void
}) {
  const [state, setState] = useState<BattleState>(() => startBattle(run, enc))
  const [menu, setMenu] = useState<'root' | 'skill'>('root')
  /**
   * 'choose'  — 내가 명령을 고르는 중. 이때만 시계가 돈다.
   * 'mine'    — 내 행동이 화면에 나오는 중
   * 'theirs'  — 상대 행동이 화면에 나오는 중
   *
   * 한 번에 다 처리하면 로그가 동시에 쏟아져 주고받는 느낌이 사라진다.
   */
  const [phase, setPhase] = useState<'choose' | 'mine' | 'theirs'>('choose')
  /**
   * 공격이 향할 적. 적이 둘 이상일 때만 의미가 있다.
   *
   * 고르는 단계를 따로 두지 않고 커서를 상시 둔다 — 명령 시간이 10초라
   * 단계를 하나 더 끼우면 그것만으로 시간이 간다.
   */
  const [target, setTarget] = useState(0)
  const doughScale = useDoughScale()
  // 실제 경과 시간으로 재야 탭을 옮겨도 시계가 멈추지 않는다.
  const last = useRef(Date.now())
  const busy = useRef(false)

  /*
   * 최신 상태를 ref 로 따로 들고 있는다.
   *
   * setState 업데이터 안에서 연출을 시작했더니 StrictMode 가 업데이터를 두 번
   * 호출해 한 턴이 겹쳐 돌았다. 업데이터는 순수해야 한다.
   */
  const stateRef = useRef(state)
  stateRef.current = state

  const targetRef = useRef(target)
  targetRef.current = target

  /*
   * 맞은 직후 잠깐만 켜지는 표시. 신선도가 줄어드는 순간을 잡는다.
   *
   * 로그를 읽어서 판정하지 않는다 — 로그 문구가 바뀌면 같이 깨지고,
   * 지속 피해처럼 문구가 여럿인 경우를 다 적어야 한다. 숫자가 줄었다는
   * 사실 하나만 보면 원인이 무엇이든 똑같이 잡힌다.
   */
  const [struck, setStruck] = useState(false)
  const lastHp = useRef(state.player.hp)
  useEffect(() => {
    const hp = state.player.hp
    const hit = hp < lastHp.current
    lastHp.current = hp
    if (!hit) return
    play('hurt')
    setStruck(true)
    const t = setTimeout(() => setStruck(false), 380)
    return () => clearTimeout(t)
  }, [state.player.hp])

  /*
   * 소리도 같은 방식으로 상태 변화에서 뽑는다 — 적 신선도가 줄면 맞은 것이고,
   * 수가 줄면 쓰러뜨린 것이다.
   *
   * 치명타만 로그를 본다. 어느 타격이 치명타였는지는 상태에 안 남고 로그에만
   * 있다. 표정 때와 달리 여기서는 로그를 봐도 된다 — 문구가 바뀌면 치명타
   * 소리가 보통 타격 소리로 돌아갈 뿐이고, 그건 덤이지 정보가 아니다.
   */
  const foeHp = state.enemies.reduce((n, e) => n + e.hp, 0)
  const foeLeft = state.enemies.filter((e) => e.hp > 0).length
  const lastFoe = useRef({ hp: foeHp, left: foeLeft })
  useEffect(() => {
    const prev = lastFoe.current
    lastFoe.current = { hp: foeHp, left: foeLeft }
    if (foeLeft < prev.left) play('down')
    else if (foeHp < prev.hp) play(state.log.some((l) => l.includes('치명타')) ? 'crit' : 'hit')
    // 로그는 소리를 고르는 데만 쓴다. 로그가 바뀌었다고 소리가 또 나면 안 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foeHp, foeLeft])

  /*
   * 적 하나하나가 방금 맞았는지 — 신선도가 준 그 개체만 잠깐 표정을 바꾼다.
   *
   * 플레이어의 struck 과 같은 원리(숫자가 줄었다는 사실만 본다)를 적마다
   * id 로 나눠서 잰다. 로그 문구는 보지 않는다 — 여럿이 한 번에 맞아도
   * 문구 하나로는 누가 맞았는지 못 가른다.
   */
  const [foeHurt, setFoeHurt] = useState<Set<string>>(new Set())
  const lastFoeHpById = useRef<Record<string, number>>(
    Object.fromEntries(state.enemies.map((e) => [e.id, e.hp])),
  )
  useEffect(() => {
    const prev = lastFoeHpById.current
    const hit: string[] = []
    for (const e of state.enemies) {
      if (e.hp < (prev[e.id] ?? e.hp)) hit.push(e.id)
      prev[e.id] = e.hp
    }
    if (hit.length === 0) return
    setFoeHurt((s) => new Set([...s, ...hit]))
    const t = setTimeout(() => {
      setFoeHurt((s) => {
        const next = new Set(s)
        hit.forEach((id) => next.delete(id))
        return next
      })
    }, 380)
    return () => clearTimeout(t)
  }, [state.enemies])

  useEffect(() => {
    if (!state.over) return
    /*
     * 마지막 라운드를 이기면 피자가 완성된다 — 라운드 클리어보다 한 음 더 간다.
     * 지는 방식은 둘이고 소리도 갈린다 — 시간이 다하면 타고(규칙 1),
     * 신선도가 다하면 상한다(규칙 2). 한 소리로 덮으면 왜 끝났는지 귀로는 모른다.
     */
    play(
      state.over === 'win'
        ? state.stage >= FINAL_STAGE
          ? 'finish'
          : 'clear'
        : state.over === 'timeout'
          ? 'burnt'
          : 'spoil',
    )
  }, [state.over, state.stage])

  /* 무엇이 더 급한지는 여기서 정한다. 위가 이긴다. */
  const mood: Mood = state.over
    ? state.over === 'win'
      ? 'win'
      : 'lose'
    : struck
      ? 'hurt'
      : state.player.statuses.some((s) => s.kind === 'guard')
        ? 'guard'
        : state.player.hp / state.player.maxHp < 0.3
          ? 'weak'
          : phase === 'mine'
            ? 'act'
            : 'idle'

  const act = useCallback((cmd: Command) => {
    const cur = stateRef.current
    if (busy.current || cur.over) return
    busy.current = true
    setMenu('root')
    /*
     * 고른 즉시 소리가 나야 누른 것이 먹혔는지 안다. 통상 공격은 여기서
     * 소리를 내지 않는다 — 맞았을 때 나는 소리와 겹쳐 두 번 들린다.
     */
    if (cmd.type === 'defend') play('guard')
    else if (cmd.type === 'item') play(cur.potions > 0 ? 'heal' : 'back')
    else if (cmd.type === 'skill') play(cur.mp >= SKILLS[cmd.id].mp ? 'skill' : 'back')
    // 놓친 턴. 내려가는 소리라 '아무 일도 없었다'가 귀로도 온다.
    else if (cmd.type === 'pass') play('back')
    // 대상은 커서가 정한다. defend/item 은 대상이 없다.
    const aimed: Command =
      cmd.type === 'attack' || cmd.type === 'skill' ? { ...cmd, target: targetRef.current } : cmd
    // 순서는 손놀림이 정한다
    void runTurn(cur, aimed, playerFirst(cur))
  }, [])

  /** 조각을 하나씩 보여 준다. 사이의 틈이 '주고받는' 느낌을 만든다. */
  const runTurn = useCallback(async (from: BattleState, cmd: Command, iGoFirst: boolean) => {
    const step = async (next: BattleState, who: 'mine' | 'theirs') => {
      setPhase(who)
      setState(next)
      stateRef.current = next
      await sleep(next.over ? 500 : STEP_MS)
      return next
    }

    let s = from
    if (iGoFirst) {
      s = await step(playerAct(s, cmd), 'mine')
      if (!s.over) s = await step(enemyAct(s), 'theirs')
    } else {
      s = await step(enemyAct(s), 'theirs')
      if (!s.over) s = await step(playerAct(s, cmd), 'mine')
    }

    if (!s.over) {
      const ended = endTurn(s)
      // 상태이상 피해 같은 마무리 로그가 있을 때만 한 박자 더 보여 준다
      setState(ended)
      stateRef.current = ended
      // 상태이상 피해 같은 마무리 로그가 있을 때만 한 박자 더 보여 준다
      if (ended.log.length > 0) await sleep(STEP_MS)
      s = ended
    }

    if (!s.over) setPhase('choose')
    // 시계는 고르는 동안만 도는데, 연출 중 흐른 시간이 한꺼번에 깎이면 안 된다.
    last.current = Date.now()
    busy.current = false
  }, [])

  // 시계. requestAnimationFrame 은 비활성 탭에서 느려지지만
  // Date.now() 차분으로 계산하므로 흘러간 시간은 그대로 반영된다.
  // 시계는 내가 고르는 동안에만 돈다. 연출 시간은 내 시간이 아니다.
  useEffect(() => {
    if (state.over || phase !== 'choose') return
    let raf = 0
    let timedOut = false
    const loop = () => {
      const now = Date.now()
      const dt = now - last.current
      last.current = now
      setState((s) => {
        if (s.over) return s
        const { state: next, timeUp } = tick(s, dt)
        /*
         * 명령 시간을 넘기면 아무것도 못 한 채 턴이 넘어간다. 상대는 그대로
         * 때리므로 손을 놓고 있으면 계속 맞는다 — 교착이 아니라 지는 길이다.
         */
        if (timeUp && !next.over && !timedOut) {
          timedOut = true
          setTimeout(() => act({ type: 'pass' }), 0)
        }
        return next
      })
      raf = requestAnimationFrame(loop)
    }
    last.current = Date.now()
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [state.over, phase, act])

  useEffect(() => {
    if (state.over === 'win') {
      onWin({ ...run, hp: state.player.hp, mp: state.mp, potions: state.potions })
    } else if (state.over === 'lose' || state.over === 'timeout') {
      onEnd(state.over)
    }
  }, [state.over, state.player.hp, state.mp, state.potions, run, onWin, onEnd])

  // 고른 적이 먼저 쓰러지는 경우가 있다. 그때는 살아 있는 쪽으로 옮긴다.
  useEffect(() => {
    if (state.enemies[target]?.hp > 0) return
    const next = state.enemies.findIndex((e) => e.hp > 0)
    if (next >= 0) setTarget(next)
  }, [state.enemies, target])

  // 도우에 올린 토핑의 맛이 곧 쓸 수 있는 기술이다
  const ownedSkills = [...new Set(run.toppings.map((t) => t.taste))].flatMap(skillsOfTaste)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (state.over || phase !== 'choose') return
      if (e.key === 'Escape') return setMenu('root')

      // 적이 둘 이상일 때만 대상을 옮긴다
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const living = state.enemies.map((en, i) => (en.hp > 0 ? i : -1)).filter((i) => i >= 0)
        if (living.length < 2) return
        const at = Math.max(0, living.indexOf(target))
        const step = e.key === 'ArrowLeft' ? -1 : 1
        setTarget(living[(at + step + living.length) % living.length])
        return
      }
      if (menu === 'root') {
        if (e.key === '1') act({ type: 'attack' })
        else if (e.key === '2') act({ type: 'defend' })
        else if (e.key === '3' && ownedSkills.length > 0) setMenu('skill')
        else if (e.key === '4') act({ type: 'item' })
      } else {
        const i = Number(e.key) - 1
        if (ownedSkills[i]) act({ type: 'skill', id: ownedSkills[i].id })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menu, act, ownedSkills, state.over, phase, state.enemies, target])

  const aliveCount = state.enemies.filter((e) => e.hp > 0).length
  const stageRatio = state.timeLeftMs / stageLimitMs(enc.kind)
  const turnRatio = state.turnLeftMs / TURN_LIMIT_MS
  const mpMax = maxMp(run.max)

  return (
    <div className={`bt bt--${enc.kind}`}>
      <ToppingCounter />
      <header className="bt__top">
        <span className="bt__stage">
          {run.stage} 라운드
          {enc.kind !== 'normal' && <b className="bt__badge">{enc.kind === 'boss' ? 'BOSS' : '중간보스'}</b>}
        </span>
        <span className={stageRatio < 0.25 ? 'bt__clock is-low' : 'bt__clock'}>
          {formatClock(state.timeLeftMs)}
        </span>
        <span className="bt__turn">{state.turn}턴</span>
      </header>
      <div className="bt__stagebar">
        <i style={{ width: `${Math.max(0, stageRatio) * 100}%` }} />
      </div>

      {/*
        고전 JRPG 구도. 상대는 위 오른쪽, 상대 정보는 위 왼쪽.
        나는 아래 왼쪽, 내 정보는 아래 오른쪽. 시선이 대각선으로 오간다.
      */}
      <section className="bt__field">
        {/* 상대는 하나씩 '정보 + 그림'을 한 덩어리로 묶는다. 따로 두면 어느 상자가
            어느 몬스터 것인지 눈으로 이어지지 않는다. */}
        <div className={`bt__side bt__side--foe${phase === 'theirs' ? ' is-acting' : ''}`}>
          {state.enemies.map((e, i) => {
            /*
             * 우선순위는 도우의 mood 와 같은 원칙 — 더 급한 정보가 이긴다.
             * 죽음 > 피격 > 스킬 사용 > 대기.
             */
            const mood: FoeMood =
              e.hp <= 0
                ? 'dead'
                : foeHurt.has(e.id)
                  ? 'hurt'
                  : phase === 'theirs' && state.specialUsers.includes(e.id)
                    ? 'skill'
                    : 'idle'
            const props = {
              unit: e,
              mood,
              selected: i === target && aliveCount > 1,
              pickable: e.hp > 0 && aliveCount > 1 && phase === 'choose',
              onPick: () => setTarget(i),
            }
            return (
              <div className="bt__unit" key={e.id}>
                <FoeInfo {...props} />
                <FoeArt {...props} />
              </div>
            )
          })}
        </div>

        <div className={`bt__side bt__side--mine${phase === 'choose' ? ' is-acting' : ''}`}>
          <div className="bt__unit">
            <CharacterSprite scale={doughScale} mood={mood} />
            <div className="bt__box bt__box--mine">
              <div className="bt__box-top">
                <b className="bt__who">{run.name}</b>
                {run.pizza && <span className="bt__job">{run.pizza.name}</span>}
                <Statuses unit={state.player} />
              </div>
              <Bar label={STAT_SHORT.hp} now={state.player.hp} max={state.player.maxHp} kind="hp" />
              <Bar label={STAT_SHORT.mag} now={state.mp} max={mpMax} kind="mp" />
            </div>
          </div>
        </div>
      </section>

      {/*
        누구 차례인지. 이 게임에서 가장 자주 확인하는 정보인데 전에는 로그 위
        11px 회색 글자 한 줄이 전부였다. 세 가지를 함께 바꾼다 —
        글자('내 차례'/'상대 차례')·색(초록/주황)·자리(왼쪽/오른쪽).
        하나만 바꾸면 놓치는 사람이 생긴다. 자리가 좌우로 튀는 것은 곁눈에도 걸린다.
      */}
      <div
        className={`bt__whose bt__whose--${phase === 'theirs' ? 'foe' : 'me'}${
          phase === 'choose' ? ' is-deciding' : ''
        }`}
      >
        <b>{phase === 'theirs' ? '상대 차례' : '내 차례'}</b>
        {phase === 'choose' && <em>명령을 고르세요</em>}
      </div>

      <section className={`bt__log bt__log--${phase}`} aria-live="polite">
        {state.log.length === 0 ? (
          <p className="bt__log-empty">
            공격 · 방어 · 기술 · 반죽물{aliveCount > 1 ? ' — ←→ 로 대상 변경' : ''}
          </p>
        ) : (
          state.log.slice(-4).map((l, i) => <p key={i}>{l}</p>)
        )}
      </section>

      {/*
        명령 시간. 막대만으로는 몇 초 남았는지 안 읽혀서 숫자를 크게 하나 둔다 —
        명령 버튼과 같은 크기라 눈이 아래로 내려가는 길에 걸린다.
      */}
      <div className="bt__turn-zone">
        <b className={`bt__turn-big${turnRatio < 0.3 ? ' is-low' : ''}`}>
          {Math.ceil(state.turnLeftMs / 1000)}
        </b>
        <div className="bt__turnbar">
          <i className={turnRatio < 0.3 ? 'is-low' : ''} style={{ width: `${turnRatio * 100}%` }} />
          <span>{Math.ceil(state.turnLeftMs / 1000)}</span>
        </div>
      </div>

      <nav className={phase === 'choose' ? 'bt__cmds' : 'bt__cmds is-locked'}>
        {menu === 'root' ? (
          <>
            <button onClick={() => act({ type: 'attack' })} disabled={phase !== 'choose'}>
              <b>1</b> 공격
            </button>
            <button onClick={() => act({ type: 'defend' })} disabled={phase !== 'choose'}>
              <b>2</b> 방어
            </button>
            <button onClick={() => setMenu('skill')} disabled={ownedSkills.length === 0 || phase !== 'choose'}>
              <b>3</b> 기술
            </button>
            <button onClick={() => act({ type: 'item' })} disabled={state.potions <= 0 || phase !== 'choose'}>
              <b>4</b> 반죽물 {state.potions}
            </button>
          </>
        ) : (
          <>
            {ownedSkills.map((sk, i) => (
              <button
                key={sk.id}
                onClick={() => act({ type: 'skill', id: sk.id })}
                disabled={state.mp < sk.mp || phase !== 'choose'}
                title={TASTE_LABEL[sk.taste]}
                className="bt__skill"
              >
                <span className="bt__skill-top">
                  <b>{i + 1}</b> {sk.name} <span className="bt__mp">{sk.mp}</span>
                </span>
                {/* 이름만 보고는 무엇을 하는 기술인지 알 수 없다 */}
                <small className="bt__skill-desc">{describeSkill(sk)}</small>
              </button>
            ))}
            <button className="bt__back" onClick={() => setMenu('root')}>
              Esc 뒤로
            </button>
          </>
        )}
      </nav>
    </div>
  )
}

/** 적의 표정. 죽음 > 피격 > 스킬 사용 > 대기 순으로 급한 쪽이 이긴다(Battle.tsx). */
type FoeMood = 'idle' | 'hurt' | 'skill' | 'dead'

/*
 * 뒷 배경 — 서브웨이 식 토핑 바. 유리 진열장 아래 야채 통이 늘어선 자리에서
 * 싸우는 느낌을 준다(Battle.css .bt__counter). 색은 맛 변수를 그대로 쓴다 —
 * 새 팔레트를 만들지 않는다.
 *
 * 한 줄로는 울타리처럼 보였다. 실제 델리 카운터는 통이 여러 줄 겹쳐
 * 안쪽까지 빼곡하다 — 뒷줄은 작고 흐리게, 앞줄은 크고 또렷하게 두어
 * 원근을 준다(Battle.css .bt__bin-row--0/1/2).
 */
const BIN_ROWS: readonly (readonly string[])[] = [
  ['herbal', 'tangy', 'mild', 'rich', 'spicy', 'herbal', 'tangy', 'mild', 'rich', 'spicy', 'herbal', 'tangy', 'mild', 'rich'],
  ['spicy', 'mild', 'rich', 'herbal', 'tangy', 'spicy', 'mild', 'rich', 'herbal', 'tangy', 'spicy', 'mild', 'rich', 'herbal'],
  ['mild', 'herbal', 'tangy', 'spicy', 'rich', 'mild', 'herbal', 'tangy', 'spicy', 'rich', 'mild', 'herbal', 'tangy', 'spicy'],
]

function ToppingCounter() {
  return (
    <div className="bt__counter" aria-hidden="true">
      <div className="bt__counter-top" />
      <div className="bt__counter-case" />
      <div className="bt__counter-bins">
        {BIN_ROWS.map((row, r) => (
          <div className={`bt__bin-row bt__bin-row--${r}`} key={r}>
            {row.map((t, i) => (
              <span key={i} className={`bt__bin bt__bin--${t}`} />
            ))}
          </div>
        ))}
      </div>
      <div className="bt__counter-glass" />
    </div>
  )
}

type FoeProps = { unit: Unit; mood: FoeMood; selected: boolean; pickable: boolean; onPick: () => void }

/** 클릭·키보드로 대상을 고를 수 있게 감싼다 */
function pickProps(p: FoeProps): HTMLAttributes<HTMLDivElement> {
  if (!p.pickable) return {}
  return {
    onClick: p.onPick,
    role: 'button',
    tabIndex: 0,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        p.onPick()
      }
    },
    'aria-pressed': p.selected,
    style: { cursor: 'pointer' },
  }
}

/** 위 왼쪽 — 상대 정보 */
function FoeInfo(p: FoeProps) {
  const cls = ['bt__box', 'bt__box--foe', p.unit.hp <= 0 && 'is-dead', p.selected && 'is-target']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} {...pickProps(p)}>
      <div className="bt__box-top">
        <span className="bt__aim">{p.selected ? '▶' : ''}</span>
        <b className="bt__who">{p.unit.name}</b>
        {p.unit.taste && <i className="bt__line">{TASTE_LABEL[p.unit.taste]}</i>}
      </div>
      <Bar label="" now={p.unit.hp} max={p.unit.maxHp} kind="enemy" />
      <Statuses unit={p.unit} />
    </div>
  )
}

/** 위 오른쪽 — 상대 그림 */
function FoeArt(p: FoeProps) {
  const cls = ['bt__foe', p.unit.hp <= 0 && 'is-dead', p.selected && 'is-target']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={cls} {...pickProps(p)}>
      <div
        className={`bt__foe-body bt__foe-body--${p.unit.taste ?? 'plain'}${
          p.mood === 'hurt' || p.mood === 'skill' ? ` bt__foe-body--mood-${p.mood}` : ''
        }`}
      >
        <FormArt form={p.unit.form ?? 'round'} />
        {/*
          재료 실루엣 위에 얹는 표정 한 겹. 도우(CharacterSprite)와 같은
          방식 — 눈·입 두 부위만 mood 로 바꾼다. 어느 모양(둥근 것·잎·고추…)
          이든 같은 자리에 얹으면 되도록 FormArt 는 손대지 않는다 — 도우 위
          토핑 아이콘으로도 같이 쓰이는 그림이라 거기엔 얼굴이 있으면 안 된다.
        */}
        <span className={`bt__foe-face bt__foe-face--${p.mood}`} aria-hidden="true">
          <i className="bt__foe-eye bt__foe-eye--l" />
          <i className="bt__foe-eye bt__foe-eye--r" />
          <i className="bt__foe-mouth" />
        </span>
      </div>
    </div>
  )
}

function Statuses({ unit }: { unit: Unit }) {
  if (unit.statuses.length === 0) return null
  return (
    <span className="bt__statuses">
      {unit.statuses.map((s) => (
        <i key={s.kind} className={`bt__st bt__st--${s.kind}`}>
          {STATUS_LABEL[s.kind] ?? s.kind}
          {s.turns > 1 && s.turns}
        </i>
      ))}
    </span>
  )
}

function Bar({
  label,
  now,
  max,
  kind,
}: {
  label: string
  now: number
  max: number
  kind: 'hp' | 'mp' | 'enemy'
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, now / max)) : 0
  return (
    <div className={`bar bar--${kind}`}>
      {label && <span className="bar__label">{label}</span>}
      <span className="bar__track">
        <i style={{ width: `${ratio * 100}%` }} />
      </span>
      <span className="bar__num">
        {Math.max(0, now)}
        <em>/{max}</em>
      </span>
    </div>
  )
}
