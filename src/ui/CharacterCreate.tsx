import { useEffect, useState } from 'react'
import { BASE_STATS, clampName, isValidName, NAME_MAX, STAT_META } from '../core/character'
import CharacterSprite, { SKIN_LABEL, type Skin } from './CharacterSprite'
import { play } from './sound'
import './CharacterCreate.css'

/**
 * 도우 색은 셋이다. 흰 도우만 처음부터 쓸 수 있고, 나머지 둘은 잠긴 카드로
 * 보여만 준다 — 해금 조건은 아직 없다(데모 단계). 골라도 시작할 수 없고,
 * 왜 안 되는지만 버튼에 그대로 뜬다.
 */
const SKINS: { id: Skin; locked: boolean }[] = [
  { id: 'white', locked: false },
  { id: 'blackRice', locked: true },
  { id: 'chlorella', locked: true },
]

const LOCK_MSG = '해제 조건을 클리어해야 획득할 수 있습니다'

export default function CharacterCreate({
  onConfirm,
  onBack,
}: {
  onConfirm: (name: string) => void
  onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [name, setName] = useState('')
  const picked = SKINS[cursor]
  const ready = isValidName(name) && !picked.locked

  const confirm = () => {
    if (ready) onConfirm(name.trim())
  }

  const moveCursor = (delta: number) => {
    setCursor((c) => (c + delta + SKINS.length) % SKINS.length)
    play('move')
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.tagName === 'INPUT'

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        moveCursor(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        moveCursor(1)
      } else if (e.key === 'Enter' || (!typing && e.key === ' ')) {
        e.preventDefault()
        if (ready) onConfirm(name.trim())
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, ready, onConfirm, onBack])

  return (
    <div className="cc">
      <header className="cc__head">
        <h2>도우 빚기</h2>
        <p>모양만 다릅니다. 시작 능력은 같습니다.</p>
      </header>

      <div className="cc__stage">
        {SKINS.map((s, i) => (
          <button
            key={s.id}
            type="button"
            className={`cc__card${i === cursor ? ' is-on' : ''}${s.locked ? ' is-locked' : ''}`}
            onClick={() => {
              if (i !== cursor) play('move')
              setCursor(i)
            }}
          >
            <CharacterSprite scale={0.8} skin={s.id} />
            <span className="cc__name">{SKIN_LABEL[s.id]}</span>
            {s.locked && <span className="cc__lock">잠김</span>}
          </button>
        ))}
      </div>

      <section className="cc__name-field">
        <label htmlFor="cc-name">이름</label>
        <input
          id="cc-name"
          className="cc__input"
          value={name}
          onChange={(e) => setName(clampName(e.target.value))}
          placeholder="이름을 입력하세요"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <span className="cc__count">
          {[...name].length} / {NAME_MAX}
        </span>
      </section>

      <section className="cc__stats">
        <h3>시작 능력</h3>
        <ul>
          {STAT_META.map((s) => (
            <li key={s.key}>
              <span className="cc__stat-label">{s.label}</span>
              <span className="cc__stat-value">{BASE_STATS[s.key]}</span>
              <span className="cc__stat-desc">{s.desc}</span>
            </li>
          ))}
        </ul>
        <p className="cc__note">
          시작 차이는 <b>도우 숙성</b>이 만듭니다. 다음 단계에서 단 한 번뿐입니다.
        </p>
      </section>

      <footer className="cc__foot">
        <button className="cc__btn cc__btn--ghost" onClick={onBack}>
          ← 뒤로
        </button>
        <button className="cc__btn cc__btn--go" onClick={confirm} disabled={!ready}>
          {picked.locked ? LOCK_MSG : isValidName(name) ? `${name.trim()}(으)로 시작 →` : '이름을 입력하세요'}
        </button>
      </footer>
      <p className="cc__hint">←→ 모양 · Enter 결정 · Esc 뒤로</p>
    </div>
  )
}
