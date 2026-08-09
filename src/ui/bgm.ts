/**
 * 배경음. 효과음과 같은 이유로 음원 파일 없이 브라우저가 합성한다(sound.ts 머리말).
 *
 * 곡은 둘이다.
 *
 *   준비곡  타이틀 → 캐릭터 → 숙성 → 분할.   도우를 자를 때까지.
 *   모험곡  둥글리기 → 성형 → 전투 → 보스.   판이 시작된 뒤.
 *
 * 그리고 곡 하나 안에서 다시 **층을 쌓아** 판이 어디까지 왔는지를 들려준다 —
 * 흰 도우 한 덩이가 피자가 되어 가는 과정이 곧 소리가 두꺼워지는 과정이다.
 *
 *   1 준비곡                       멜로디 + 통통 튀는 화음      아직 도우뿐이다
 *   2 모험곡                       + 달리는 베이스 + 셰이커     떠난다 / 재료가 붙는다
 *   3 모험곡 + 깔리는 화음         8라운드, 도우가 피자가 된 뒤
 *   4 모험곡 + 16분음 반짝임       마지막 판
 *
 * ── 두 곡을 어떻게 이어 붙였나
 *
 * 곡이 바뀌는 자리에서 딴 데로 가 버리면 '판이 시작됐다'가 아니라 '화면이
 * 바뀌었다'만 남는다. 그래서 바꾼 것과 안 바꾼 것을 갈라 두었다.
 *
 *   그대로  · 음색(삼각파 가락 · 사인 베이스 · 얇은 셰이커)
 *           · 8마디 한 바퀴, 4/4
 *           · 쓰는 음 — 임시표가 하나도 없다. 다장조와 가단조는 같은 음을 쓴다
 *           · 화음 넉 장(C·G·Am·F)과 층을 쌓는 방식
 *   바뀜    · 중심음 — 도(C) 에서 라(Am) 로. 같은 음인데 서 있는 자리가 달라진다
 *           · 빠르기 — 126 → 152
 *           · 베이스 — 통통 튀던 것이 8분음으로 달린다
 *
 * 가락도 첫 마디를 준비곡에서 그대로 떠 왔다. 준비곡이 도-미-솔-미로 오르면
 * 모험곡은 라-도-미-도로 오른다 — 같은 계단을 한 칸 낮은 자리에서 밟는다.
 *
 * 웅장한 쪽으로는 두 곡 다 안 갔다. 낮은 북도, 긴 현도 없다. 긴장은 소리를
 * 키워서가 아니라 베이스가 쉬지 않고 달려서 나온다.
 */

import { musicBus, watchMute } from './sound'

/** 0 은 꺼짐. 1 은 준비곡, 2 이상은 모험곡이고 숫자만큼 층이 두껍다 */
export type MusicLevel = 0 | 1 | 2 | 3 | 4

/*
 * 이만큼 앞까지 미리 예약해 둔다. setInterval 은 몇십 ms 씩 늦게 오는데,
 * 그때 가서 소리를 내면 박자가 흔들린다. 미리 잡아 두면 브라우저가 늦어도
 * 소리는 정확한 시각에 난다.
 */
const LOOKAHEAD = 0.7
const TICK_MS = 180
/** 곡이 갈릴 때 앞 곡이 사그라드는 시간. 그동안 새 곡이 겹쳐 올라온다 */
const CROSS = 0.5
/** 곡이 처음 올라오는 시간 */
const FADE_IN = 0.5

/* --- 음이름 → 주파수 ------------------------------------------------- */

const PITCH: Record<string, number> = {
  C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11,
}

/** 'A4' → 440. 표를 주파수로 적으면 고쳐 쓸 수가 없어 음이름으로 둔다. */
function hz(name: string): number {
  const m = /^([A-G]#?)(\d)$/.exec(name)
  if (!m) return 440
  return 440 * 2 ** ((PITCH[m[1]] + (Number(m[2]) - 4) * 12 - 9) / 12)
}

/* --- 곡 --------------------------------------------------------------- */

/** 음 하나. at·len 은 마디 안에서의 박 */
type Step = { n: string; at: number; len: number }

type Track = {
  bpm: number
  /** 마디별 화음. 길이가 곧 한 바퀴의 마디 수다 */
  chords: string[][]
  /** 마디별 베이스 뿌리음 */
  bass: string[]
  melody: Step[][]
  /** soft 는 통통 튀고 drive 는 달린다 */
  style: 'soft' | 'drive'
}

/*
 * ── 준비곡 ────────────────────────────────────────────────────────────
 *
 * 126 BPM. 걷는 속도(약 110)보다 조금 빠르다 — 서두르지는 않으면서 들뜬 자리다.
 * 화음은 C - G - Am - F. 밝은 노래가 거의 다 여기서 나온다.
 */
const PREP: Track = {
  bpm: 126,
  style: 'soft',
  chords: [
    ['C4', 'E4', 'G4'],
    ['B3', 'D4', 'G4'],
    ['A3', 'C4', 'E4'],
    ['A3', 'C4', 'F4'],
    ['C4', 'E4', 'G4'],
    ['B3', 'D4', 'G4'],
    ['A3', 'C4', 'F4'],
    ['B3', 'D4', 'G4'],
  ],
  bass: ['C3', 'G2', 'A2', 'F2', 'C3', 'G2', 'F2', 'G2'],
  /*
   * 다장조 5음계에서 거의 벗어나지 않는다 — 반음이 없으면 어느 음을 짚어도
   * 어긋나지 않아 마냥 밝게만 들린다. 음을 박에 딱 붙이지 않고 8분음으로 끊어
   * 통통 튀게 뒀다. 마지막 마디는 레-미-솔로 올라가다 멈춘다. 안 닫히니까
   * 한 바퀴 돌아 처음의 도로 이어질 때 이어 붙은 티가 안 난다.
   */
  melody: [
    [{ n: 'C5', at: 0, len: 0.75 }, { n: 'E5', at: 1, len: 0.75 }, { n: 'G5', at: 2, len: 0.75 }, { n: 'E5', at: 3, len: 0.5 }],
    [{ n: 'D5', at: 0, len: 0.75 }, { n: 'G5', at: 1, len: 0.75 }, { n: 'B4', at: 2, len: 0.75 }, { n: 'D5', at: 3, len: 0.5 }],
    [{ n: 'E5', at: 0, len: 0.75 }, { n: 'C5', at: 1, len: 0.75 }, { n: 'A4', at: 2, len: 0.75 }, { n: 'C5', at: 3, len: 0.5 }],
    [{ n: 'F5', at: 0, len: 1.5 }, { n: 'E5', at: 2, len: 0.75 }, { n: 'D5', at: 3, len: 0.5 }],
    [{ n: 'E5', at: 0, len: 0.4 }, { n: 'G5', at: 0.5, len: 0.4 }, { n: 'E5', at: 1, len: 0.75 }, { n: 'C5', at: 2, len: 0.75 }, { n: 'D5', at: 3, len: 0.5 }],
    [{ n: 'D5', at: 0, len: 0.75 }, { n: 'B4', at: 1, len: 0.4 }, { n: 'D5', at: 1.5, len: 0.4 }, { n: 'G5', at: 2, len: 1.25 }],
    [{ n: 'A5', at: 0, len: 0.75 }, { n: 'G5', at: 1, len: 0.75 }, { n: 'F5', at: 2, len: 0.75 }, { n: 'E5', at: 3, len: 0.5 }],
    [{ n: 'D5', at: 0, len: 0.75 }, { n: 'E5', at: 1, len: 0.75 }, { n: 'G5', at: 2, len: 1.6 }],
  ],
}

/*
 * ── 모험곡 ────────────────────────────────────────────────────────────
 *
 * 152 BPM. 준비곡의 1.2배다 — 두 배로 잡으면 다른 곡이 되고, 조금만 올리면
 * 안 바뀐 것처럼 들린다. 걷다가 뛰기 시작하는 자리가 이쯤이다.
 *
 * 화음은 Am - F - C - G. 준비곡이 쓰던 넉 장을 그대로 쓰되 시작하는 자리만
 * Am 으로 돌렸다. 다장조와 가단조는 건반이 같아서, 음은 하나도 안 바꾸고
 * 중심만 옮긴 것이다 — 어두워지는 게 아니라 '떠나는' 쪽으로 기운다.
 *
 * 마지막 두 마디는 Dm - Em 으로 올라간다. 여기서 Am 으로 닫아 버리면 한 바퀴가
 * 끝나 버려 반복이 지루해진다. 안 닫고 위로 밀어 두면 다음 바퀴로 끌려 들어간다.
 */
const QUEST: Track = {
  bpm: 152,
  style: 'drive',
  chords: [
    ['A3', 'C4', 'E4'],
    ['A3', 'C4', 'F4'],
    ['C4', 'E4', 'G4'],
    ['B3', 'D4', 'G4'],
    ['A3', 'C4', 'E4'],
    ['A3', 'C4', 'F4'],
    ['A3', 'D4', 'F4'],
    ['B3', 'E4', 'G4'],
  ],
  bass: ['A2', 'F2', 'C3', 'G2', 'A2', 'F2', 'D3', 'E3'],
  /*
   * 첫 마디 라-도-미-도는 준비곡 첫 마디 도-미-솔-미와 같은 계단이다.
   * 같은 걸음을 한 칸 낮은 자리에서 밟는 것이라, 곡이 바뀌어도 아는 가락이다.
   *
   * 대신 음을 촘촘히 놨다. 준비곡은 4분음이 뼈대였는데 여기는 8분음이 뼈대다 —
   * 빠르기만 올리고 음을 그대로 두면 그냥 빨리 감은 것처럼 들린다.
   */
  melody: [
    [{ n: 'A4', at: 0, len: 0.45 }, { n: 'C5', at: 0.5, len: 0.45 }, { n: 'E5', at: 1, len: 0.9 }, { n: 'C5', at: 2, len: 0.45 }, { n: 'A4', at: 2.5, len: 0.45 }, { n: 'E5', at: 3, len: 0.9 }],
    [{ n: 'F5', at: 0, len: 0.9 }, { n: 'E5', at: 1, len: 0.45 }, { n: 'C5', at: 1.5, len: 0.45 }, { n: 'A4', at: 2, len: 0.9 }, { n: 'C5', at: 3, len: 0.9 }],
    [{ n: 'G4', at: 0, len: 0.45 }, { n: 'C5', at: 0.5, len: 0.45 }, { n: 'E5', at: 1, len: 0.9 }, { n: 'G5', at: 2, len: 1.4 }],
    [{ n: 'D5', at: 0, len: 0.45 }, { n: 'G5', at: 0.5, len: 0.45 }, { n: 'F5', at: 1, len: 0.45 }, { n: 'D5', at: 1.5, len: 0.45 }, { n: 'B4', at: 2, len: 1.4 }],
    [{ n: 'A4', at: 0, len: 0.45 }, { n: 'C5', at: 0.5, len: 0.45 }, { n: 'E5', at: 1, len: 0.45 }, { n: 'A5', at: 1.5, len: 1.4 }, { n: 'G5', at: 3, len: 0.9 }],
    [{ n: 'F5', at: 0, len: 0.9 }, { n: 'A5', at: 1, len: 0.9 }, { n: 'G5', at: 2, len: 0.45 }, { n: 'F5', at: 2.5, len: 0.45 }, { n: 'E5', at: 3, len: 0.9 }],
    [{ n: 'D5', at: 0, len: 0.45 }, { n: 'F5', at: 0.5, len: 0.45 }, { n: 'A5', at: 1, len: 0.9 }, { n: 'F5', at: 2, len: 0.45 }, { n: 'D5', at: 2.5, len: 0.45 }, { n: 'A4', at: 3, len: 0.9 }],
    [{ n: 'E5', at: 0, len: 0.45 }, { n: 'G5', at: 0.5, len: 0.45 }, { n: 'B5', at: 1, len: 0.9 }, { n: 'G5', at: 2, len: 0.45 }, { n: 'E5', at: 2.5, len: 0.45 }, { n: 'B4', at: 3, len: 0.9 }],
  ],
}

/* --- 소리 내기 --------------------------------------------------------- */

let ctx: AudioContext | null = null
let noiseBuf: AudioBuffer | null = null

/**
 * 지금 곡이 나가는 통로. 곡마다 하나씩 새로 판다.
 *
 * 통로를 하나로 돌려 쓰면 곡을 바꿀 때 앞 곡이 새어 나온다. 마디는 0.7초 앞까지
 * 미리 예약해 두고 층3의 깔리는 화음은 한 마디를 통째로 물고 있어서, 통로를
 * 닫았다 다시 열면 그 소리들이 새 곡 위로 되살아난다. 통로를 갈아 버리면
 * 앞 곡은 제 통로와 함께 사그라들고 새 곡은 깨끗한 데서 시작한다.
 */
let deck: GainNode | null = null

/** 새 통로를 판다. 소리가 꺼져 있으면 null */
function openDeck(secs: number): GainNode | null {
  const got = musicBus()
  if (!got) return null
  ctx = got.ctx
  const g = ctx.createGain()
  const now = ctx.currentTime
  g.gain.setValueAtTime(0.0001, now)
  g.gain.linearRampToValueAtTime(1, now + secs)
  g.connect(got.bus)
  return g
}

/** 쓰던 통로를 사그라뜨리고 떼어 낸다. 안 떼면 한 판에 몇 개씩 매달린 채 남는다. */
function closeDeck(g: GainNode | null, secs: number): void {
  if (!g || !ctx) return
  const now = ctx.currentTime
  g.gain.cancelScheduledValues(now)
  g.gain.setValueAtTime(g.gain.value, now)
  g.gain.linearRampToValueAtTime(0, now + secs)
  // 물고 있던 긴 화음까지 다 죽고 나서 끊는다
  window.setTimeout(() => g.disconnect(), (secs + 2.5) * 1000)
}

type Voice = {
  /** 절대 시각(AudioContext 기준) */
  at: number
  freq: number
  dur: number
  vol: number
  wave: OscillatorType
  /** 크기를 물고 있는 시간. 길게 깔아 두는 음에 쓴다 */
  hold?: number
  /** 시작 주파수를 이만큼 올려 잡았다가 제자리로 미끄러진다(반음) */
  bend?: number
}

function voice(v: Voice): void {
  if (!ctx || !deck) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = v.wave

  const end = v.at + v.dur
  if (v.bend) {
    // 살짝 위에서 제자리로 떨어뜨린다. 음이 '뽕' 하고 앉는 소리가 여기서 난다.
    osc.frequency.setValueAtTime(v.freq * 2 ** (v.bend / 12), v.at)
    osc.frequency.exponentialRampToValueAtTime(v.freq, v.at + Math.min(0.08, v.dur * 0.5))
  } else {
    osc.frequency.setValueAtTime(v.freq, v.at)
  }

  const rise = Math.min(0.01, v.dur * 0.25)
  g.gain.setValueAtTime(0.0001, v.at)
  g.gain.exponentialRampToValueAtTime(v.vol, v.at + rise)
  if (v.hold) g.gain.setValueAtTime(v.vol, Math.min(v.at + rise + v.hold, end - 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(g).connect(deck)
  osc.start(v.at)
  osc.stop(end + 0.02)
}

/**
 * 셰이커. 짧은 잡음 한 점이다.
 * hp 를 낮추면 두께가 붙어 뒷박을 짚는 소리(림)가 된다.
 */
function shake(at: number, vol: number, hp = 6500, dur = 0.035): void {
  if (!ctx || !deck) return
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.15)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const f = ctx.createBiquadFilter()
  f.type = 'highpass'
  f.frequency.value = hp
  const g = ctx.createGain()
  g.gain.setValueAtTime(vol, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  src.connect(f).connect(g).connect(deck)
  src.start(at)
  src.stop(at + dur + 0.03)
}

/** 마디 하나를 통째로 예약한다. t0 는 그 마디가 시작하는 절대 시각 */
function scheduleBar(track: Track, i: number, t0: number, level: MusicLevel): void {
  const beat = 60 / track.bpm
  const bar = beat * 4
  const chord = track.chords[i]
  const drive = track.style === 'drive'

  // 가락 — 삼각파를 짧게 끊어 친다. 위에 사인을 아주 작게 겹쳐 반짝임만 남긴다.
  for (const s of track.melody[i]) {
    const at = t0 + s.at * beat
    const dur = s.len * beat
    voice({ at, freq: hz(s.n), dur, vol: 0.16, wave: 'triangle', hold: dur * 0.3 })
    voice({ at, freq: hz(s.n) * 2, dur: dur * 0.6, vol: 0.03, wave: 'sine' })
  }

  /*
   * 화음은 뒷박에만 놓는다. 앞박에 같이 치면 행진이 되고, 뒤로 밀면 깡충거린다.
   * 준비곡은 두 번(1.5·3.5박), 모험곡은 네 번 — 같은 자리를 더 촘촘히 짚을 뿐
   * 치는 방식은 안 바꿨다. 발랄함과 다급함이 여기서 갈린다.
   */
  for (const b of drive ? [0.5, 1.5, 2.5, 3.5] : [1.5, 3.5]) {
    for (const n of chord) {
      voice({ at: t0 + b * beat, freq: hz(n), dur: beat * 0.28, vol: drive ? 0.05 : 0.055, wave: 'triangle' })
    }
  }

  if (level >= 2) {
    /*
     * 베이스. 사인파를 반음 위에서 떨어뜨려 '뽕' 하고 앉게 했다 —
     * 톱니파로 두면 몸통이 단단해져 몽실한 쪽에서 멀어진다.
     *
     * 준비곡은 네 번 툭툭 짚고 쉬는데, 모험곡은 8분음으로 쉬지 않고 달린다.
     * 긴장은 소리를 키워서가 아니라 여기서 나온다 — 멈추는 자리가 없으면
     * 듣는 쪽도 숨을 못 고른다. 숫자는 뿌리음에 곱하는 배수다(2 는 옥타브, 1.5 는 5도).
     */
    const root = hz(track.bass[i])
    const pattern: [number, number][] = drive
      ? [[0, 1], [0.5, 1], [1, 1], [1.5, 2], [2, 1], [2.5, 1], [3, 2], [3.5, 1.5]]
      : [[0, 1], [1.5, 1], [2.5, 2], [3.5, 1]]
    for (const [b, mul] of pattern) {
      voice({
        at: t0 + b * beat,
        freq: root * mul,
        dur: beat * (drive ? 0.34 : 0.45),
        vol: drive ? 0.115 : 0.13,
        wave: 'sine',
        bend: 1.2,
      })
    }

    // 셰이커는 뒷박. 베이스와 어긋나며 굴러가는 느낌을 만든다
    for (const b of [0.5, 1.5, 2.5, 3.5]) shake(t0 + b * beat, 0.035)
    /*
     * 모험곡만 2·4박을 한 번 더 짚는다. 잡음을 덜 깎아 두께를 남긴 소리다 —
     * 북을 하나 놓으면 웅장해지므로 북 대신 이걸 쓴다.
     */
    if (drive) {
      for (const b of [1, 3]) shake(t0 + b * beat, 0.05, 1900, 0.055)
    }
  }

  if (level >= 3) {
    /*
     * 깔리는 화음. 마디 내내 붙들고 있는 이 한 겹이 들어오는 순간
     * 같은 가락인데도 판이 넓어진다 — 도우가 피자가 된 자리다.
     */
    for (const n of chord) {
      voice({ at: t0, freq: hz(n) / 2, dur: bar * 0.95, vol: 0.045, wave: 'sine', hold: bar * 0.6 })
    }
  }

  if (level >= 4) {
    /*
     * 반짝임. 화음을 16분음으로 훑어 올린다. 크기를 아주 낮춰 가락을 가리지
     * 않게 두었다 — 마지막 판이라고 소리를 키우면 곡의 성격이 바뀐다.
     */
    const notes = [...chord, chord[0]]
    for (let k = 0; k < 16; k++) {
      voice({
        at: t0 + k * beat * 0.25,
        freq: hz(notes[k % notes.length]) * 2,
        dur: beat * 0.2,
        vol: 0.038,
        wave: 'sine',
      })
    }
  }
}

/* --- 시간 관리 --------------------------------------------------------- */

let want: MusicLevel = 0
/** 지금 흐르는 곡. 멎어 있으면 null */
let active: Track | null = null
let timer = 0
/** 다음 마디가 울릴 시각 */
let nextAt = 0
let barNo = 0
/** 브라우저가 소리를 허락했나 — 첫 클릭/키 입력 전에는 못 낸다 */
let armed = false

function trackFor(level: MusicLevel): Track | null {
  if (level === 0) return null
  return level === 1 ? PREP : QUEST
}

function schedule(): void {
  // 탭을 옮겼다 오면 멈춰 있을 수 있다. 매번 불러 깨운다.
  if (!musicBus() || !ctx || !active || !deck) return

  const now = ctx.currentTime
  const bar = (60 / active.bpm) * 4
  // 탭을 옮겼다 오면 예약 시각이 한참 뒤처져 있다. 밀린 마디를 몰아 내지 않는다.
  if (nextAt < now) nextAt = now + 0.05

  while (nextAt < now + LOOKAHEAD) {
    scheduleBar(active, barNo % active.melody.length, nextAt, want)
    barNo++
    nextAt += bar
  }
}

function run(track: Track): void {
  const g = openDeck(FADE_IN)
  if (!g) return // 소리가 꺼져 있다. 켜지면 watchMute 가 다시 부른다.
  deck = g
  active = track
  nextAt = 0
  barNo = 0
  schedule()
  if (!timer) timer = window.setInterval(schedule, TICK_MS)
}

function halt(fade: number): void {
  if (timer) {
    window.clearInterval(timer)
    timer = 0
  }
  active = null
  closeDeck(deck, fade)
  deck = null
}

/**
 * 지금 판이 어디쯤인지 알려 준다.
 *
 * 같은 곡 안에서 층만 달라지면 곡은 안 끊기고 다음 마디부터 두꺼워진다.
 * 곡이 갈리면(준비 ↔ 모험) 앞 곡이 사그라드는 위로 새 곡이 올라온다 —
 * 빠르기가 달라 마디를 이어 붙일 수는 없지만, 두 곡이 같은 음을 쓰기 때문에
 * 겹치는 반 초 동안 부딪히지 않는다. 사이를 비우는 것보다 이쪽이 안 끊긴다.
 */
export function setMusic(level: MusicLevel): void {
  want = level
  const next = trackFor(level)

  if (!next) {
    halt(0.5)
    return
  }
  // 같은 곡이 이미 흐르고 있다. 층은 다음 마디에 알아서 반영된다.
  if (next === active && timer) return

  if (!armed) {
    /*
     * 브라우저는 사용자가 한 번 누르기 전에는 소리를 막는다. 그 전에 곡을
     * 걸면 멈춘 시계 위에 마디가 쌓였다가 나중에 한꺼번에 터진다.
     * 첫 입력을 기다렸다가 시작한다 — 타이틀에서 반드시 한 번은 누른다.
     */
    const go = () => {
      armed = true
      window.removeEventListener('pointerdown', go)
      window.removeEventListener('keydown', go)
      const t = trackFor(want)
      if (t) run(t)
    }
    window.addEventListener('pointerdown', go)
    window.addEventListener('keydown', go)
    return
  }

  // 앞 곡은 제 통로와 함께 사그라들고, 새 곡이 그 위로 올라온다
  if (active) halt(CROSS)
  run(next)
}

/* 소리를 다시 켜면 곡도 이어서 살아난다. 끄면 스케줄러까지 세운다. */
watchMute((muted) => {
  if (muted) {
    halt(0.1)
    return
  }
  const t = trackFor(want)
  if (t && armed && !timer) run(t)
})
