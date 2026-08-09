import { useEffect } from 'react'
import { STAT_LABEL, STAT_SHORT } from '../core/character'
import type { EnemyDef } from '../core/enemy'
import { canAddTopping, slotsOf, type Run } from '../core/run'
import CharacterSprite from './CharacterSprite'
import { play } from './sound'
import { KIND_LABEL, TASTE_LABEL, toppingStats } from '../core/topping'
import './Recruit.css'

/**
 * 라운드를 이긴 뒤 나오는 화면.
 * 쓰러뜨린 재료를 도우에 올릴지 지나칠지 고른다.
 *
 * 올리면 능력치가 오르지만 무게만큼 손놀림이 깎이고 자리도 하나 줄어든다.
 * 그 대가가 없으면 '지나치기'를 누를 이유가 사라진다.
 */
export default function Recruit({
  run,
  defeated,
  onDone,
}: {
  run: Run
  defeated: EnemyDef[]
  onDone: (picked: EnemyDef | null) => void
}) {
  const full = !canAddTopping(run)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const i = Number(e.key) - 1
      if (!full && defeated[i]) {
        e.preventDefault()
        play('place')
        onDone(defeated[i])
      } else if (e.key === 'Escape' || e.key === '0') {
        e.preventDefault()
        onDone(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [defeated, full, onDone])

  return (
    <div className="rc">
      <header className="rc__head">
        <h2>재료를 얻었다</h2>
        <p>
          도우에 올리면 힘이 되지만 무거워집니다. 자리는{' '}
          <b>
            {run.toppings.length} / {slotsOf(run)}
          </b>
        </p>
      </header>

      {/*
        도우는 맨몸 그대로 보여 준다. 실제 피자는 소스 → 토핑 순인데, 여기서
        재료를 바로 얹어 보이면 소스도 없이 토핑부터 올라간 것처럼 보인다.
        무엇을 얼마나 모았는지는 숫자(자리 X/Y)로만 알려 주고, 실제 모습은
        보스를 잡아 소스를 얻은 뒤 완성 연출(PizzaBake)에서 한 번에 보여 준다.
      */}
      <div className="rc__dough">
        <CharacterSprite scale={1} />
      </div>

      <div className="rc__cards">
        {defeated.map((e, i) => {
          const t = e.topping
          const gain = toppingStats(t)
          const [key, value] = Object.entries(gain)[0]
          return (
            <button
              key={t.id}
              className="rc__card"
              onClick={() => {
                play('place')
                onDone(e)
              }}
              disabled={full}
              title={full ? '도우가 가득 찼습니다' : undefined}
            >
              <span className="rc__kind">{KIND_LABEL[t.kind]}</span>
              <b className="rc__name">{t.name}</b>
              <span className="rc__taste">{TASTE_LABEL[t.taste]}</span>
              <span className="rc__gain">
                {STAT_LABEL[key as keyof typeof STAT_LABEL]} +{value}
              </span>
              <span className="rc__weight">
                무게 {t.weight} — {STAT_SHORT.spd} −{t.weight}
              </span>
              <span className="rc__key">{i + 1}</span>
            </button>
          )
        })}
      </div>

      {full && <p className="rc__full">도우가 가득 찼습니다. 더 올릴 수 없습니다.</p>}

      <footer className="rc__foot">
        <button className="rc__skip" onClick={() => onDone(null)}>
          지나치기 →
        </button>
        <p className="rc__hint">숫자키 동료로 만들기 · Esc 지나치기</p>
      </footer>
    </div>
  )
}
