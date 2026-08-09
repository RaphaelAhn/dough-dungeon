import { useEffect, useState } from 'react'
import { CODEX_TOTAL, discoveredCount, loadCodex } from '../core/codex'
import PizzaMark from './PizzaMark'
import { isMuted, play, toggleMute } from './sound'
import './TitleScreen.css'

export type TitleAction = 'start' | 'codex' | 'howto'

const MENU: { id: TitleAction; label: string }[] = [
  { id: 'start', label: '게임 시작' },
  { id: 'codex', label: '피자 도감' },
  { id: 'howto', label: '조작 안내' },
]

export default function TitleScreen({ onSelect }: { onSelect: (a: TitleAction) => void }) {
  const [cursor, setCursor] = useState(0)
  const [mute, setMute] = useState(isMuted)
  const found = discoveredCount(loadCodex())

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault()
        const delta = e.key === 'ArrowUp' ? -1 : 1
        setCursor((c) => (c + delta + MENU.length) % MENU.length)
        play('move')
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        play('select')
        onSelect(MENU[cursor].id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, onSelect])

  return (
    <div className="title">
      <div className="title__top">
        <PizzaMark size={104} />
        <h1 className="title__logo">
          Dough to <span>Journey</span>
        </h1>
        <p className="title__tag">숙성하고, 모으고, 구워라</p>
      </div>

      <nav className="title__menu">
        {MENU.map((m, i) => (
          <button
            key={m.id}
            className={i === cursor ? 'menu__item is-on' : 'menu__item'}
            onMouseEnter={() => {
              if (i !== cursor) play('move')
              setCursor(i)
            }}
            onClick={() => {
              play('select')
              onSelect(m.id)
            }}
          >
            <span className="menu__mark">{i === cursor ? '▶' : ''}</span>
            {m.label}
          </button>
        ))}
      </nav>

      <footer className="title__foot">
        <span className="title__pieces">
          도감 <b>{found}</b> / {CODEX_TOTAL}
        </span>
        {/* 소리는 켜진 채로 시작한다. 끄는 자리를 첫 화면에 둬야 찾는다. */}
        <button
          type="button"
          className="title__mute"
          aria-pressed={mute}
          onClick={() => {
            const now = toggleMute()
            setMute(now)
            // 켜는 순간에만 소리를 낸다 — 끌 때 나면 껐는데 소리가 나는 셈이다
            if (!now) play('select')
          }}
        >
          소리 {mute ? '꺼짐' : '켜짐'}
        </button>
        <span className="title__hint">↑↓ 선택 · Enter 결정</span>
      </footer>
    </div>
  )
}
