export type Stats = {
  hp: number
  atk: number
  mag: number
  spd: number
  luk: number
}

/**
 * 모든 도우는 같은 값으로 시작한다.
 * 시작 차이는 주사위가 만든다.
 */
export const BASE_STATS: Stats = {
  hp: 100,
  atk: 20,
  mag: 20,
  spd: 10,
  luk: 10,
}

/**
 * 능력치 이름은 여기 한 곳에서만 정한다.
 * 화면마다 따로 적어 두면 같은 값이 '마법력'과 '반죽 탄력'으로 갈린다.
 */
export const STAT_META: { key: keyof Stats; label: string; desc: string }[] = [
  { key: 'hp', label: '신선도', desc: '0이 되면 상해서 버린다' },
  { key: 'atk', label: '반죽 탄력', desc: '직접 때리는 힘' },
  { key: 'mag', label: '반죽 두께', desc: '기술 위력이자 기술을 쓸 밑천' },
  { key: 'spd', label: '신축성', desc: '선공 판정·회피' },
  { key: 'luk', label: '촉감', desc: '보상 등급·결정적 한 방' },
]

export const STAT_LABEL: Record<keyof Stats, string> = {
  hp: '신선도',
  atk: '반죽 탄력',
  mag: '반죽 두께',
  spd: '신축성',
  luk: '촉감',
}

/** 짧게 쓰는 자리(게이지 라벨, 전투 로그)용 */
export const STAT_SHORT: Record<keyof Stats, string> = {
  hp: '신선도',
  atk: '탄력',
  mag: '두께',
  spd: '신축',
  luk: '촉감',
}

export const NAME_MAX = 8

/**
 * 입력 이름을 8자로 자른다.
 * 길이는 코드 포인트 기준 — 이모지나 일부 한자는 .length 로 세면 2로 잡혀
 * 4자만 쳐도 잘리고, slice 로 자르면 글자가 반 토막 나 깨진다.
 */
export function clampName(raw: string): string {
  return [...raw].slice(0, NAME_MAX).join('')
}

/** 공백만 남는 이름은 거부한다. */
export function isValidName(raw: string): boolean {
  const n = [...raw.trim()]
  return n.length > 0 && n.length <= NAME_MAX
}
