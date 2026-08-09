import type { Topping } from '../core/topping'
import FormArt from './FormArt'
import './PizzaArt.css'

/**
 * 완성된 피자 그림 — 넓게 편 크러스트 위에 소스 · 토핑 · 치즈를 실제 피자처럼
 * 겹쳐 그린다. PizzaBake(화덕 연출)와 Result(결과 화면)가 같이 쓴다 —
 * 화덕에서 막 꺼낸 그 모습이 결과 화면에서도 그대로 보여야, 결과 화면이
 * "도우에 점 몇 개"가 아니라 "방금 구운 피자"로 읽힌다.
 *
 * ⚠ 실제로 올린 재료는 최대 일곱 종류뿐이다(토핑 자리 상한). 종류 수만큼만
 * 그리면 아무리 잘 흩어도 사진 속 페퍼로니 피자처럼 안 된다 — 진짜 피자는
 * 같은 재료를 여러 조각 겹쳐서 편이다. 그래서 한 "종류"당 여러 "조각"을
 * 그린다 — 종류가 하나뿐이어도(페퍼로니 하나만 얹었어도) 그 하나로 판을
 * 채운다.
 */

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180)

/** 판을 덮을 목표 조각 수. 사진 속 페퍼로니 피자 밀도에 맞춘 값이다 */
const TOTAL_PIECES = 20
/**
 * 처음 solids.length 조각(재료마다 하나씩)만 정박(staggerMs)으로 나타난다 —
 * PizzaBake 의 소리(재료마다 한 번)가 여기에 맞춰 울린다. 그 뒤로 판을
 * 채우는 나머지 조각은 소리 없이 훨씬 빨리 뿌려진다 — 하나하나가 아니라
 * '뿌려지는' 느낌이어야 한다.
 */
const FILL_STAGGER_MS = 34

/**
 * 재료 종류들을 정해진 총 조각 수까지 돌려 채운다.
 * 앞쪽 solids.length 개는 원래 순서 그대로(=사운드 타이밍과 일치),
 * 그 뒤는 같은 순서를 반복해 채운다.
 */
function buildPieces(solids: Topping[]): Topping[] {
  if (solids.length === 0) return []
  const total = Math.max(TOTAL_PIECES, solids.length)
  return Array.from({ length: total }, (_, i) => solids[i % solids.length])
}

function pieceDelay(i: number, primaryCount: number, staggerMs: number): number {
  if (i < primaryCount) return i * staggerMs
  return primaryCount * staggerMs + (i - primaryCount) * FILL_STAGGER_MS
}

/** PizzaBake 가 "토핑 뿌리기" 구간을 얼마나 붙들고 있어야 하는지 계산한다 */
export function toppingRevealMs(solidsCount: number, staggerMs: number): number {
  if (solidsCount === 0) return 0
  const total = Math.max(TOTAL_PIECES, solidsCount)
  return pieceDelay(total - 1, solidsCount, staggerMs) + 260
}

function scatterPoint(i: number, n: number, maxR: number): { x: number; y: number } {
  const r = maxR * Math.sqrt((i + 0.5) / n)
  const a = i * GOLDEN_ANGLE
  return { x: r * Math.cos(a), y: r * Math.sin(a) }
}

export default function PizzaArt({
  toppings,
  baked = false,
  size = 240,
  showSauce = true,
  showToppings = true,
  showCheese = true,
  staggerMs = 130,
}: {
  /** 소스 포함 전체 토핑 목록 */
  toppings: Topping[]
  /** 화덕에서 나온 뒤 — 크러스트와 치즈가 노릇해진다 */
  baked?: boolean
  /** 지름(px) */
  size?: number
  /** 아래 세 플래그는 PizzaBake 가 단계별로 하나씩 켤 때 쓴다. 기본은 전부 켠 상태 */
  showSauce?: boolean
  showToppings?: boolean
  showCheese?: boolean
  /** 재료 종류가 하나씩 나타나는 간격(ms). PizzaBake 의 소리 타이밍과 맞춘다 */
  staggerMs?: number
}) {
  const sauce = toppings.find((t) => t.kind === 'sauce')
  const solids = toppings.filter((t) => t.kind !== 'sauce')
  const pieces = buildPieces(solids)
  const scatterR = size * 0.43
  const topSize = Math.round(size * 0.125)

  return (
    <div className={`pa${baked ? ' is-baked' : ''}`} style={{ width: size, height: size }}>
      <span className="pa__crust" aria-hidden="true" />
      {sauce && (
        <span
          className={`pa__sauce pa__sauce--${sauce.taste}${showSauce ? ' is-on' : ''}`}
          aria-hidden="true"
        />
      )}
      {showToppings &&
        pieces.map((tp, i) => {
          const p = scatterPoint(i, pieces.length, scatterR)
          return (
            <span
              key={`${tp.id}-${i}`}
              className={`pa__top pa__top--${tp.taste}`}
              style={{
                width: topSize,
                height: topSize,
                left: `calc(50% + ${p.x}px)`,
                top: `calc(50% + ${p.y}px)`,
                animationDelay: `${pieceDelay(i, solids.length, staggerMs)}ms`,
              }}
              title={tp.name}
            >
              <FormArt form={tp.form} />
            </span>
          )
        })}
      <span className={`pa__cheese${showCheese ? ' is-on' : ''}`} aria-hidden="true" />
      {/*
        얼굴은 구워진 뒤에만 그린다 — 화덕에서 막 꺼낸 피자가 웃는 순간이지,
        아직 재료만 얹힌 반죽에 그릴 표정이 아니다. 치즈보다 위(z-index)에
        둬야 토핑이 많아도 얼굴이 파묻히지 않는다.
      */}
      {baked && (
        <span className="pa__face" aria-hidden="true">
          <i className="pa__eye pa__eye--l" />
          <i className="pa__eye pa__eye--r" />
          <i className="pa__nose" />
          <i className="pa__mouth" />
        </span>
      )}
    </div>
  )
}
