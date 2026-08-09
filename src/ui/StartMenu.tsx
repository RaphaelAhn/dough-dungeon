import { useEffect, useState } from 'react'
import { play } from './sound'
import './StartMenu.css'

/**
 * 게임 시작 메뉴 — 타이틀의 "게임 시작"과 실제 도우 빚기 사이에 낀 한 칸.
 *
 * 세 칸 중 "피자 만들기"만 지금 열려 있다. 나머지 둘(재료 찾기·월드 오브
 * 피자)은 아직 만들 콘텐츠가 없어 잠가 두되, 존재는 미리 보여 둔다 — 도우
 * 도감의 잠긴 색(CharacterCreate.tsx)과 같은 자리다. 골라도 넘어가지 않고
 * 왜 안 되는지만 뜬다.
 */

type ItemId = 'make' | 'find' | 'world'

const ITEMS: { id: ItemId; label: string; locked: boolean }[] = [
  { id: 'make', label: '피자 만들기', locked: false },
  { id: 'find', label: '재료 찾기', locked: true },
  { id: 'world', label: '월드 오브 피자', locked: true },
]

const LOCK_MSG = '선택 시 조건을 만족해야 해금됩니다.'

export default function StartMenu({
  onMake,
  onBack,
}: {
  onMake: () => void
  onBack: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [notice, setNotice] = useState(false)

  const choose = (i: number) => {
    const item = ITEMS[i]
    if (item.locked) {
      play('back')
      setNotice(true)
      return
    }
    play('select')
    onMake()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const delta = e.key === 'ArrowUp' ? -1 : 1
        setCursor((c) => (c + delta + ITEMS.length) % ITEMS.length)
        setNotice(false)
        play('move')
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        choose(cursor)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor])

  return (
    <div className="sm">
      <h2 className="sm__title">게임 시작</h2>

      <nav className="sm__menu">
        {ITEMS.map((it, i) => (
          <button
            key={it.id}
            type="button"
            className={`sm__item${i === cursor ? ' is-on' : ''}${it.locked ? ' is-locked' : ''}`}
            onMouseEnter={() => {
              if (i !== cursor) play('move')
              setCursor(i)
              setNotice(false)
            }}
            onClick={() => choose(i)}
          >
            <span className="sm__mark">{i === cursor ? '▶' : ''}</span>
            {it.label}
            {it.locked && <span className="sm__lock">잠김</span>}
          </button>
        ))}
      </nav>

      <p className={`sm__notice${notice ? ' is-on' : ''}`}>{LOCK_MSG}</p>

      <button className="sm__back" onClick={onBack}>
        ← 뒤로
      </button>
      <p className="sm__hint">↑↓ 선택 · Enter 결정 · Esc 뒤로</p>
    </div>
  )
}
