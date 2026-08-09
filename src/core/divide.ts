import type { Stats } from './character'

/**
 * 분할 — 숙성이 끝난 반죽을 피자 한 판 크기로 떼어내는 단계.
 *
 * 실제 피자는 큰 반죽을 저울에 달아 나눈다. 몇 그램을 떼느냐가 피자 지름을
 * 정하고, 지름이 두께와 굽는 시간을 정한다. 그래서 이 한 번의 선택이
 * 판 전체의 성격을 정한다 — 이 게임에서 되돌릴 수 없는 두 번째 선택이다.
 *
 * 게임 규칙으로 옮기면 이렇다.
 *   많이 떼면  자리가 늘고 두꺼워 잘 버틴다. 대신 무거워 손이 늦다.
 *   적게 떼면  자리가 줄지만 얇고 가벼워 손이 빠르다.
 *
 * 무게가 손놀림을 깎는다는 규칙은 토핑에 이미 있다(topping.ts totalWeight).
 * 분할은 그 규칙을 판 시작 시점으로 끌어온 것이고, 그래서 새 규칙을 배울
 * 필요가 없다 — 이미 아는 저울이 하나 더 놓일 뿐이다.
 */
export type Portion = 'small' | 'medium' | 'large' | 'huge'

export type PortionSpec = {
  id: Portion
  /** 떼어낸 반죽 무게(g). 저울이 재는 것이 바로 이 값이라 화면에 그대로 보여 준다 */
  grams: number
  /** 다 폈을 때의 지름(cm). 저울은 무게를 재지 지름을 재지 않는다 — 화면에는 안 나온다 */
  cm: number
  /** 피자집에서 쓰는 사이즈 이름 */
  label: string
  /** 이 크기가 감당하는 재료 자리 */
  slots: number
  /** 시작 능력치 보정 */
  gain: Partial<Stats>
  desc: string
}

/**
 * ⚠ 자리는 4·5·6·7 이다. 일곱을 넘기지 않는다.
 *
 * 도우 그림의 재료 자리는 얼굴(눈·입)을 피해 가장자리를 도는 고리 위에만
 * 놓을 수 있다. 조건(표정 7종의 눈·입 회피 + 재료끼리 안 겹침 + 크러스트
 * 안쪽)을 걸어 탐색하면 크기 17%·고리 0.37 에서 일곱 자리가 나온다.
 * 여덟은 재료를 16% 로 줄여야 들어가는데 그 크기면 실루엣이 뭉갠다.
 *
 * 무게는 실제 피자 규격을 따랐다 —
 * 25cm 200~250g · 30cm 250~320g · 35cm 350~450g · 그 위는 40cm 대형판.
 *
 * ⚠ 크다고 좋고 작다고 나쁜 사다리가 되면 안 된다. 원판이 정하는 것이라
 *   고를 수 없기 때문이다 — 어느 칸에 서도 쓸 만해야 뽑기가 벌칙이 안 된다.
 *   자리 수는 그 자체로 이득이므로, 보정은 작은 쪽을 받치고 큰 쪽을 누른다.
 */
export const PORTIONS: readonly PortionSpec[] = [
  {
    id: 'small',
    grams: 220,
    cm: 25,
    label: '스몰',
    slots: 4,
    // 얇으니 가볍고 빠르다. 대신 담을 자리가 적다.
    gain: { spd: 4, luk: 2, atk: 1 },
    desc: '얇고 가볍다. 손이 빠르지만 자리가 적다.',
  },
  {
    id: 'medium',
    grams: 290,
    cm: 30,
    label: '레귤러',
    slots: 5,
    gain: { hp: 8, spd: 1 },
    desc: '무난하다. 어느 쪽으로도 치우치지 않는다.',
  },
  {
    id: 'large',
    grams: 400,
    cm: 35,
    label: '라지',
    slots: 6,
    // 두꺼우니 잘 버틴다. 대신 무거워 손이 늦다.
    gain: { hp: 15, atk: 1, spd: -5 },
    desc: '두껍고 무겁다. 잘 버티지만 손이 늦다.',
  },
  {
    id: 'huge',
    grams: 520,
    cm: 40,
    label: '패밀리',
    slots: 7,
    /*
     * 자리가 가장 많은 대신 가장 굼뜨다. 손놀림을 크게 깎아 두어야
     * '무조건 큰 게 좋다'가 안 된다 — 원판이 정하는 것이라 더 그렇다.
     */
    gain: { hp: 26, atk: 3, spd: -9, luk: -2 },
    desc: '한 판이 크다. 자리는 가장 많지만 손이 많이 늦다.',
  },
]

export function portionOf(id: Portion): PortionSpec {
  return PORTIONS.find((p) => p.id === id) ?? PORTIONS[1]
}

/**
 * 저울이 잴 무게를 뽑는다. 넷 중 하나를 똑같은 확률로 고른다.
 *
 * 예전엔 원판이라 여덟 칸(네 크기를 두 번씩)에 나눠 돌렸다 — 같은 크기가
 * 이웃하면 두 칸이 한 칸처럼 보여 돌린 의미가 없어지기 때문이다. 저울에는
 * 그 문제가 없다. 볼 칸이 없으니 넷 중 하나를 바로 고르면 그걸로 25% 다.
 */
export function pickPortion(rng: () => number = Math.random): Portion {
  return PORTIONS[Math.floor(rng() * PORTIONS.length)].id
}
