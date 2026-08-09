import { TASTE_LABEL, type Topping } from '../core/topping'
import FormArt from './FormArt'
import './CharacterSprite.css'

/**
 * 도우 캐릭터. 이미지 파일 없이 CSS 도형으로만 그린다.
 *
 * 원본을 96×112 로 고정해 그리고 확대·축소는 transform 이 한다.
 * 바깥 상자만 줄이면 안쪽 그림이 상자를 뚫고 나온다 — 실제로 그 버그가 있었다.
 */
const ART_W = 96
const ART_H = 112

/**
 * 도우의 표정. 눈과 입 두 부위만 바꿔서 만든다 — 부위를 늘리면 자리마다
 * 다시 맞춰야 하고, 여섯 칸 토핑과 겹치는 자리가 생긴다.
 *
 * 전투가 상황을 알려 주고 여기서는 그리기만 한다. 무엇이 더 급한지는
 * 부르는 쪽이 정한다(Battle.tsx) — 쓰러짐 > 승리 > 피격 > 방어 > 지침.
 */
export type Mood = 'idle' | 'act' | 'guard' | 'weak' | 'hurt' | 'win' | 'lose'

/**
 * 반죽 색. 흰 도우가 기본이고, 나머지 둘은 도우 빚기 화면의 잠긴 카드다
 * (CharacterCreate.tsx) — 지금은 색만 다르고 시작 능력에는 손대지 않는다.
 */
export type Skin = 'white' | 'blackRice' | 'chlorella'

export const SKIN_LABEL: Record<Skin, string> = {
  white: '흰 도우',
  blackRice: '흑미 도우',
  chlorella: '클로렐라 도우',
}

/**
 * 토핑이 놓이는 자리 — 도우 중심 기준 극좌표(각도°, 반지름 비율).
 * 얼굴(중앙)을 피해 가장자리를 돌며 놓인다. 상한 6칸에 맞춰 여섯 자리.
 */
/*
 * 얼굴을 피해 가장자리를 도는 여섯 자리 (각도°, 반지름 비율).
 *
 * 전에는 여섯 중 셋이 두 눈과 입을 덮고 있었다. 좌표를 계산해 보니
 * 205°·335° 자리가 눈에, 95° 자리가 입에 정확히 얹혔다.
 *
 * 고리를 넓히면 도우 밖으로 나가고 좁히면 얼굴을 덮는다 — 얼굴이 도우를
 * 거의 다 차지해서 들어갈 틈이 없었다. 그래서 얼굴을 0.85 로 줄여
 * 가장자리에 고리 하나를 냈다(.sprite__face).
 *
 * 자리는 손으로 찍지 않고 조건을 걸어 찾았다 — 표정 7종이 쓰는 눈·입 범위를
 * 모두 피하고, 재료끼리 겹치지 않고, 크러스트 안쪽에 들어오는 배치.
 * 좌우 대칭은 포기했다. 대칭으로 여섯을 놓으면 아래 한가운데가 반드시
 * 입에 걸린다 — 쓰러짐 표정의 입이 가장 아래까지 내려오기 때문이다.
 *
 * 일곱 자리다. 여섯에서 늘렸고, 조건은 그대로 두고 다시 탐색했다 —
 * 여덟은 재료를 16% 로 줄여야 들어가는데 그 크기면 실루엣이 뭉갠다.
 *
 * 순서는 각도 순이 아니다. 하나씩 채워질 때 한쪽으로 쏠리지 않게
 * 처음 셋을 벌려 두었다.
 */
const RING = 0.37
const SPOTS: [number, number][] = [
  [270, RING],
  [50, RING],
  [180, RING],
  [315, RING],
  [130, RING],
  [225, RING],
  [0, RING],
]

export default function CharacterSprite({
  scale = 4,
  toppings = [],
  mood = 'idle',
  skin = 'white',
}: {
  scale?: number
  /** 도우에 올린 재료. 올린 순서대로 자리를 채운다. */
  toppings?: Topping[]
  mood?: Mood
  skin?: Skin
}) {
  const sauce = toppings.find((t) => t.kind === 'sauce')
  const solid = toppings.filter((t) => t.kind !== 'sauce')
  const base = SKIN_LABEL[skin]
  const label = toppings.length === 0 ? base : `${base} — ${toppings.map((t) => t.name).join(', ')}`

  return (
    <div
      className={`sprite sprite--${mood} sprite--skin-${skin}${sauce ? ' sprite--sauced' : ''}`}
      style={{
        width: ART_W * scale,
        height: ART_H * scale,
        ['--s' as string]: scale,
      }}
      role="img"
      aria-label={label}
    >
      <div className="sprite__stack">
        <span className="sprite__shadow" />
        <span className="sprite__body">
          {/*
            치즈. 재료를 올릴수록 진해진다.
            여섯 개를 다 채워도 큰 도우에 점 여섯 개뿐이라 허전했다 — 가운데를
            채워 줄 것이 필요한데, 소스는 보스를 잡아야 생기므로 그 전까지
            도우가 계속 맨몸이었다.
          */}
          {solid.length > 0 && (
            <i className="sprite__cheese" style={{ opacity: 0.22 + solid.length * 0.11 }} />
          )}
          {/* 소스는 도우 위에 깔린다. 보스를 잡아야 생긴다. */}
          {sauce && <i className={`sprite__sauce sprite__sauce--${sauce.taste}`} />}
          {/*
            얼굴을 한 겹으로 묶어 통째로 줄인다. 부위마다 px 을 다시 잡으면
            표정 7종의 눈·입 좌표를 전부 따라 고쳐야 하고, 한 곳만 빠뜨려도
            그 표정에서만 얼굴이 어긋난다.
          */}
          <span className="sprite__face">
            <i className="sprite__eye sprite__eye--l" />
            <i className="sprite__eye sprite__eye--r" />
            <i className="sprite__mouth" />
          </span>
          {solid.slice(0, SPOTS.length).map((t, i) => {
            const [deg, r] = SPOTS[i]
            const rad = (deg * Math.PI) / 180
            return (
              <i
                key={`${t.id}-${i}`}
                className={`sprite__top sprite__top--${t.taste}`}
                style={{
                  left: `${50 + Math.cos(rad) * r * 100}%`,
                  top: `${50 + Math.sin(rad) * r * 100}%`,
                }}
                title={`${t.name} (${TASTE_LABEL[t.taste]})`}
              >
                <FormArt form={t.form} />
              </i>
            )
          })}
        </span>
      </div>
    </div>
  )
}
