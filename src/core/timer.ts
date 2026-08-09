import type { Encounter } from './enemy'

/**
 * 제한 시간. 데모 규칙 두 가지 중 첫 번째다.
 *
 *   1. 제한 시간 내 클리어하지 못하면 게임 오버
 *   2. 전투 중 사망하면 게임 오버 (남은 시간과 무관)
 *
 * 두 조건은 완전히 독립이다. 시간이 남아도 죽으면 끝이고,
 * 살아 있어도 시간이 다하면 끝이다.
 */

/** 한 턴 안에 커맨드를 고를 시간. 넘기면 그 턴은 아무것도 못 한다. */
export const TURN_LIMIT_MS = 10_000

/** 스테이지 하나를 클리어할 시간 */
export const STAGE_LIMIT_MS = 100_000
/** 보스·중간보스는 더 길게 */
export const BOSS_LIMIT_MS = 150_000

/**
 * 두 제한은 서로 맞물린다.
 *
 *   100초 ÷ 10초 = 10턴   (일반 스테이지)
 *   150초 ÷ 10초 = 15턴   (보스)
 *
 * 즉 스테이지 제한은 느리게 고르는 플레이어에게는 '턴 예산'으로,
 * 빠르게 고르는 플레이어에게는 '시간 예산'으로 작동한다.
 * 빨리 고르면 턴을 더 쓸 수 있고, 오래 고민하면 턴이 줄어든다.
 * 어느 쪽이든 화력이 부족하면 시간으로 갚게 된다.
 */
export function stageLimitMs(kind: Encounter['kind']): number {
  return kind === 'normal' ? STAGE_LIMIT_MS : BOSS_LIMIT_MS
}

/** 스테이지 제한 시간이 허용하는 최대 턴 수 (모든 턴을 끝까지 쓴 경우) */
export function maxTurns(kind: Encounter['kind']): number {
  return Math.floor(stageLimitMs(kind) / TURN_LIMIT_MS)
}

/**
 * 시계는 전투 중에만 흐른다. 보상 선택과 메뉴에서는 멈춘다.
 *
 * 보상 화면에서도 시간이 흐르면 "고민되는 3택"이 성립하지 않는다.
 * 급하게 고르면 판단이 아니라 반사가 되고, 그건 기획서 04 §0 이 요구하는 것과 반대다.
 * 시간 압박은 전투 실행에 걸고, 선택에는 걸지 않는다.
 */
export function shouldTick(screen: 'battle' | 'other'): boolean {
  return screen === 'battle'
}

/** 남은 시간을 0:00 형태로. 초는 올림해서 0 이 보이면 정말 끝난 것이 되게 한다. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** 턴 타이머는 초 단위 숫자만 보여준다 */
export function formatTurnClock(ms: number): string {
  return String(Math.max(0, Math.ceil(ms / 1000)))
}
