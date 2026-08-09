import { doughName, FERMENT_TIERS } from '../core/dice'
import './Ferment.css'

/** 온도계 눈금 범위 (℃). 냉장 숙성이라 한 자릿수다. */
const TEMP_MIN = -2
const TEMP_MAX = 12

const clamp01 = (n: number) => Math.max(0, Math.min(1, n))

/**
 * 냉장 숙성실의 계기 두 개 — 온도계와 숙성 게이지.
 *
 * 결과를 정하는 건 여전히 난수지만, 화면에서는 '숙성 조건'이 결과를 만든 것처럼
 * 읽혀야 한다. 그래서 두 계기가 함께 움직이고 함께 멈춘다.
 */
export default function Ferment({
  temp,
  ferment,
  rolling = false,
}: {
  temp: number
  ferment: number
  /** 숙성 중 — 계기가 흔들린다 */
  rolling?: boolean
}) {
  const level = clamp01((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN))
  const cls = ['fm', rolling && 'fm--rolling'].filter(Boolean).join(' ')

  return (
    <div className={cls}>
      <div className="fm__thermo" role="img" aria-label={`온도 ${temp}도`}>
        <div className="fm__tube">
          {/* 눈금 — 위가 높은 온도다 */}
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className="fm__tick" style={{ bottom: `${i * 25}%` }} />
          ))}
          <i className="fm__mercury" style={{ height: `${level * 100}%` }} />
        </div>
        <div className="fm__bulb" />
        <span className="fm__temp">{temp}℃</span>
      </div>

      <div className="fm__gauge" role="img" aria-label={`숙성도 ${ferment}퍼센트 — ${doughName(ferment)}`}>
        <span className="fm__label">숙성도</span>
        <span className="fm__bar">
          <i style={{ width: `${clamp01(ferment / 100) * 100}%` }} />
          {/*
            구간 경계. 이름이 숙성도에서 나오니 어디서 이름이 바뀌는지 보여야 한다.
            예전엔 80% 부터를 '잘 익은 구간'으로 칠했는데, 그러면 높을수록 좋다는
            뜻이 되어 '여섯 결과에 우열이 없다'는 규칙과 어긋난다.
          */}
          {FERMENT_TIERS.slice(1).map((t) => (
            <em key={t.min} className="fm__div" style={{ left: `${t.min}%` }} />
          ))}
        </span>
        <span className="fm__pct">{ferment}%</span>
      </div>
    </div>
  )
}
