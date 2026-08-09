/**
 * 소리. 음원 파일 없이 브라우저가 그때그때 합성한다.
 *
 * 왜 파일을 안 쓰나 — 캐릭터·적·게이지를 전부 CSS 로 그린 것과 같은 이유다.
 * 짧은 효과음 열몇 개도 파일로 두면 수백 KB 가 붙고, 심사자가 링크를 눌렀을
 * 때 첫 소리까지 기다리게 된다. 그리고 제출 서류의 저작권 확인서는 '순수
 * 창작물'을 요구한다 — 무료 음원을 쓰면 출처를 따로 밝혀야 하지만 오실레이터로
 * 만든 소리는 따질 것이 없다. 지금 이 파일이 소리의 전부고 용량은 0 이다.
 *
 * 브라우저는 사용자가 한 번 누르기 전에는 소리를 못 내게 막는다(자동재생 정책).
 * 그래서 AudioContext 를 미리 만들지 않고 첫 play() 때 만든다. 타이틀 화면에서
 * 반드시 한 번은 누르므로 실제로 걸리는 일은 없다.
 */

type Wave = OscillatorType

/** 음 하나. from → to 로 미끄러지며 dur 초 동안 난다. */
type Tone = {
  wave?: Wave
  from: number
  /** 끝 주파수. 없으면 음이 안 움직인다 */
  to?: number
  dur: number
  /** 0~1 */
  vol?: number
  /** 시작 지연(초) */
  at?: number
  /**
   * 크기를 그대로 물고 있는 시간(초). 이만큼 지난 뒤부터 사그라든다.
   *
   * 없으면 소리가 나자마자 곧바로 줄기 시작한다 — 짧게 치는 소리에는 맞지만
   * 길게 끄는 음이나 밑에 깔아 두는 음은 이게 없으면 다 꺼져 버린다.
   */
  hold?: number
}

/** 부딪히는 소리. 음정이 없는 잡음을 짧게 끊어 쓴다. */
type Noise = {
  dur: number
  vol?: number
  at?: number
  /** 이 주파수 아래를 깎는다. 높일수록 얇고 날카로워진다 */
  hp?: number
  /** 이 주파수 위를 깎는다. 낮출수록 둔하고 묵직해진다 — 북에 쓴다 */
  lp?: number
}

type Spec = { tones?: Tone[]; noise?: Noise[] }

const MUTE_KEY = 'dough:mute'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuf: AudioBuffer | null = null
let muted = readMuted()

/**
 * 음악이 흐르는 통로. 효과음은 master 로 바로 가고 음악만 여기를 거친다.
 *
 * 통로를 가른 이유는 두 가지다. hush() 가 효과음을 끊을 때 배경음까지 멎으면
 * 안 되고, 음악은 효과음 밑에 깔려 있어야 하므로 한 번에 눌러 둘 자리가 필요하다.
 */
let music: GainNode | null = null

/* 음악은 효과음의 절반 조금 위. 이보다 크면 때리는 소리를 덮는다. */
const MUSIC_VOL = 0.55

/** 소리가 켜졌다/꺼졌다를 배경음 쪽에 알린다. bgm.ts 가 하나 걸어 둔다. */
let muteWatcher: ((muted: boolean) => void) | null = null

export function watchMute(fn: (muted: boolean) => void): void {
  muteWatcher = fn
}

/**
 * 음악을 내보낼 통로를 얻는다. 소리가 꺼져 있거나 브라우저가 못 하면 null 이다.
 * 배경음 쪽에서 이 값이 null 인 동안은 아무것도 예약하지 않는다.
 */
export function musicBus(): { ctx: AudioContext; bus: GainNode } | null {
  if (!ensure() || !ctx || !master) return null
  if (!music) {
    music = ctx.createGain()
    music.gain.value = MUSIC_VOL
    music.connect(master)
  }
  return { ctx, bus: music }
}


/**
 * 지금 울리고 있는(또는 울리기로 예약된) 소리들.
 *
 * 끝나는 소리는 5초 넘게 끈다. 다음으로 넘어가려는 사람을 소리가 붙잡으면
 * 안 되므로 중간에 끊을 수 있어야 하는데, 한번 예약한 노드는 붙들고 있지
 * 않으면 다시 만질 수 없다. 그래서 끝날 때까지 들고 있는다.
 */
const live = new Set<{ src: AudioScheduledSourceNode; gain: GainNode }>()

function track(src: AudioScheduledSourceNode, gain: GainNode): void {
  const entry = { src, gain }
  live.add(entry)
  // 제 수명을 다한 것은 스스로 빠진다. 안 그러면 한 판 내내 쌓인다.
  src.onended = () => live.delete(entry)
}

/**
 * 울리는 중인 소리를 모두 멈춘다.
 *
 * 곧바로 stop() 하면 파형이 잘려 '딱' 소리가 난다. 40ms 에 걸쳐 내린 뒤 끊는다 —
 * 사람 귀에는 즉시로 들리면서 잡음은 안 생기는 길이다.
 */
export function hush(): void {
  if (!ctx) return
  const now = ctx.currentTime
  for (const { src, gain } of live) {
    try {
      gain.gain.cancelScheduledValues(now)
      gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04)
      src.stop(now + 0.05)
    } catch {
      /* 이미 끝난 노드는 손댈 수 없다. 무시한다. */
    }
  }
  live.clear()
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    // 사생활 보호 모드에서 localStorage 가 막힌다. 소리는 켜 두고 넘어간다.
    return false
  }
}

export function isMuted(): boolean {
  return muted
}

export function toggleMute(): boolean {
  muted = !muted
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    /* 저장이 안 돼도 이번 판에서는 꺼진 채로 간다 */
  }
  if (master && ctx) {
    master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ctx.currentTime, 0.01)
  }
  /*
   * 꺼진 채로 시작하면 AudioContext 자체가 없어 배경음이 한 마디도 예약되지
   * 않는다. 다시 켰을 때 곡이 살아나려면 이쪽에서 깨워 줘야 한다.
   */
  muteWatcher?.(muted)
  return muted
}

/*
 * 전체 크기. 0.22 로 잡았더니 렌더링 최대 진폭이 0.05~0.12 밖에 안 나왔다 —
 * 헤드폰이면 몰라도 노트북 스피커에서는 거의 안 들리는 수준이다.
 * 0.45 면 최대 0.11~0.26 으로, 놀랄 정도는 아니면서 들린다.
 */
const MASTER_VOL = 0.45

function ensure(): boolean {
  if (muted) return false
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return false
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = MASTER_VOL
    master.connect(ctx.destination)

    // 잡음은 한 번만 만들어 두고 돌려 쓴다. 매번 만들면 소리마다 버퍼가 쌓인다.
    const len = Math.floor(ctx.sampleRate * 0.4)
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = noiseBuf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  }
  /*
   * 탭을 옮겼다 오면 멈춰 있다. 다시 깨운다.
   * resume() 은 거절될 수 있다 — 놓아두면 콘솔에 미처리 거부가 쌓인다.
   * 소리 하나 못 낸 것으로 판이 멈출 이유는 없으니 삼킨다.
   */
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {})
  return true
}

function tone(t: Tone, now: number): void {
  if (!ctx || !master) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = t.wave ?? 'square'

  const at = now + (t.at ?? 0)
  const end = at + t.dur
  osc.frequency.setValueAtTime(t.from, at)
  if (t.to !== undefined) {
    // 0 으로 가면 exponential 이 죽는다. 아래를 막아 둔다.
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, t.to), end)
  }

  /*
   * 소리를 갑자기 끊으면 딱 하는 잡음이 난다. 아주 짧게 올렸다가 내린다.
   * 0 에서 exponential 을 시작할 수 없어 아주 작은 값에서 출발한다.
   */
  const vol = t.vol ?? 0.5
  const rise = Math.min(0.012, t.dur * 0.3)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + rise)
  // 물고 있는 구간. 끝을 넘지 않게 막아 둔다 — 넘으면 램프 순서가 뒤집힌다.
  if (t.hold) g.gain.setValueAtTime(vol, Math.min(at + rise + t.hold, end - 0.01))
  g.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(g).connect(master)
  osc.start(at)
  osc.stop(end + 0.02)
  track(osc, g)
}

function noise(n: Noise, now: number): void {
  if (!ctx || !master || !noiseBuf) return
  const src = ctx.createBufferSource()
  src.buffer = noiseBuf
  const g = ctx.createGain()
  const at = now + (n.at ?? 0)
  const end = at + n.dur

  const vol = n.vol ?? 0.3
  g.gain.setValueAtTime(vol, at)
  g.gain.exponentialRampToValueAtTime(0.0001, end)

  let node: AudioNode = src
  if (n.hp) {
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = n.hp
    node.connect(f)
    node = f
  }
  if (n.lp) {
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = n.lp
    node.connect(f)
    node = f
  }
  node.connect(g).connect(master)
  src.start(at)
  src.stop(end + 0.02)
  track(src, g)
}

/*
 * 소리표. 이름이 게임에서 벌어진 일을 가리키고, 값은 그 일이 어떻게 들리는지다.
 * 화면 쪽에서 주파수를 만지지 않게 여기 다 모아 둔다.
 */
const SPECS = {
  /* --- 메뉴 --- */
  move: { tones: [{ from: 620, dur: 0.045, vol: 0.3, wave: 'square' as Wave }] },
  select: {
    tones: [
      { from: 520, to: 790, dur: 0.09, vol: 0.35 },
      { from: 780, dur: 0.07, at: 0.06, vol: 0.22, wave: 'triangle' as Wave },
    ],
  },
  back: { tones: [{ from: 440, to: 280, dur: 0.09, vol: 0.28 }] },

  /* --- 전투 --- */
  /** 통상 공격이 맞았다 */
  hit: {
    noise: [{ dur: 0.09, vol: 0.34, hp: 900 }],
    tones: [{ from: 190, to: 90, dur: 0.09, vol: 0.3, wave: 'square' as Wave }],
  },
  /** 치명타 — 같은 때림인데 더 얇고 길다 */
  crit: {
    noise: [{ dur: 0.14, vol: 0.4, hp: 1500 }],
    tones: [
      { from: 300, to: 120, dur: 0.14, vol: 0.32, wave: 'square' as Wave },
      { from: 980, to: 1560, dur: 0.1, at: 0.03, vol: 0.2, wave: 'triangle' as Wave },
    ],
  },
  /** 기술 — 음이 올라간다. 맞는 소리와 헷갈리면 안 된다 */
  skill: {
    tones: [
      { from: 400, to: 1000, dur: 0.16, vol: 0.28, wave: 'triangle' as Wave },
      { from: 600, to: 1500, dur: 0.14, at: 0.05, vol: 0.18, wave: 'sine' as Wave },
    ],
  },
  /** 방어 — 낮고 짧게. 막았다는 느낌 */
  guard: {
    tones: [{ from: 260, to: 200, dur: 0.13, vol: 0.3, wave: 'triangle' as Wave }],
    noise: [{ dur: 0.06, vol: 0.16, hp: 500 }],
  },
  /** 반죽물 — 올라가는 세 음 */
  heal: {
    tones: [
      { from: 520, dur: 0.08, vol: 0.26, wave: 'sine' as Wave },
      { from: 660, dur: 0.08, at: 0.07, vol: 0.26, wave: 'sine' as Wave },
      { from: 790, dur: 0.14, at: 0.14, vol: 0.26, wave: 'sine' as Wave },
    ],
  },
  /** 내가 맞았다 — 아래로 미끄러진다 */
  hurt: {
    tones: [{ from: 330, to: 110, dur: 0.2, vol: 0.34, wave: 'sawtooth' as Wave }],
    noise: [{ dur: 0.1, vol: 0.2, hp: 400 }],
  },
  /** 적을 쓰러뜨렸다 */
  down: {
    tones: [
      { from: 420, to: 160, dur: 0.18, vol: 0.3, wave: 'square' as Wave },
      { from: 210, to: 80, dur: 0.22, at: 0.1, vol: 0.24, wave: 'triangle' as Wave },
    ],
  },

  /* --- 판의 마디 --- */
  /** 라운드 클리어 — 올라가는 세 음 */
  clear: {
    tones: [
      { from: 523, dur: 0.11, vol: 0.3, wave: 'triangle' as Wave },
      { from: 659, dur: 0.11, at: 0.1, vol: 0.3, wave: 'triangle' as Wave },
      { from: 784, dur: 0.26, at: 0.2, vol: 0.32, wave: 'triangle' as Wave },
    ],
  },
  /**
   * 피자 완성 — 판 하나가 끝나는 자리다. 짧은 효과음이 아니라 작은 곡으로 간다.
   *
   * 도-미-솔-도-미-솔 로 두 옥타브를 타고 올라가 꼭대기에서 물고, 그 아래
   * 장3화음을 깔아 둔다. 마지막에 한 번 더 높이 얹어 여운을 남긴다.
   */
  finish: {
    tones: [
      // 올라가는 계단
      { from: 523, dur: 0.16, vol: 0.3, wave: 'triangle' as Wave },
      { from: 659, dur: 0.16, at: 0.13, vol: 0.3, wave: 'triangle' as Wave },
      { from: 784, dur: 0.16, at: 0.26, vol: 0.3, wave: 'triangle' as Wave },
      { from: 1047, dur: 0.2, at: 0.39, vol: 0.32, wave: 'triangle' as Wave },
      { from: 1319, dur: 0.2, at: 0.55, vol: 0.32, wave: 'triangle' as Wave },
      // 꼭대기 — 물고 있다가 길게 사그라든다
      { from: 1568, dur: 1.5, at: 0.71, vol: 0.34, hold: 0.45, wave: 'triangle' as Wave },
      // 아래에 깔리는 장3화음
      { from: 523, dur: 1.9, at: 0.71, vol: 0.12, hold: 0.7, wave: 'sine' as Wave },
      { from: 659, dur: 1.9, at: 0.71, vol: 0.11, hold: 0.7, wave: 'sine' as Wave },
      { from: 784, dur: 1.9, at: 0.71, vol: 0.1, hold: 0.7, wave: 'sine' as Wave },
      { from: 131, dur: 2.4, at: 0.71, vol: 0.16, hold: 0.9, wave: 'triangle' as Wave },
      // 마지막 한 번 더 — 여운
      { from: 2093, dur: 1.5, at: 2.2, vol: 0.2, hold: 0.2, wave: 'sine' as Wave },
      { from: 1047, dur: 1.6, at: 2.2, vol: 0.18, hold: 0.3, wave: 'triangle' as Wave },
    ],
  },
  /**
   * 상했다 — 반죽이 무너져 판이 끝났다(규칙 2).
   *
   * 끝나는 방식이 둘인데 한 소리로 덮으면 무엇 때문에 끝났는지 귀로는 모른다.
   * 이쪽은 바람이 빠지는 소리다 — 톱니파를 길게 끌어내리고, 살짝 어긋난
   * 톱니를 겹쳐 맥놀이로 시큼하게 만든 뒤, 바닥에 둔탁하게 떨군다.
   */
  spoil: {
    noise: [{ dur: 0.5, vol: 0.12, lp: 600 }],
    tones: [
      /*
       * 가락은 가단조 하행 — 라·솔·파·미. 내려가는 단조는 그것만으로 처진다.
       * 음을 짧게 끊지 않고 물었다가 길게 놓아, 서두르지 않는 슬픔으로 만든다.
       */
      { from: 440, dur: 1.1, vol: 0.26, hold: 0.3, wave: 'triangle' as Wave },
      { from: 392, dur: 1.1, at: 0.75, vol: 0.26, hold: 0.3, wave: 'triangle' as Wave },
      { from: 349, dur: 1.2, at: 1.5, vol: 0.26, hold: 0.35, wave: 'triangle' as Wave },
      { from: 330, dur: 2.6, at: 2.3, vol: 0.28, hold: 0.9, wave: 'triangle' as Wave },
      // 밑에 깔리는 낮은 라. 처음부터 끝까지 깔려 있어야 가라앉는다
      { from: 110, dur: 6.2, vol: 0.2, hold: 3.6, wave: 'sine' as Wave },
      // 5도(미)를 뒤늦게 얹는다. 화음이 닫히면서 체념하는 자리다
      { from: 165, dur: 3.0, at: 2.3, vol: 0.15, hold: 1.4, wave: 'sine' as Wave },
      /*
       * 3Hz 어긋난 짝. 맞물리지 않아 아주 느리게 웅웅거린다 —
       * 소리가 곱게 안 나고 살짝 물러 있는 느낌이 여기서 나온다.
       */
      { from: 333, dur: 2.6, at: 2.3, vol: 0.12, hold: 0.9, wave: 'triangle' as Wave },
      // 마지막에 한 번 더 가라앉는다
      { from: 220, to: 82, dur: 2.4, at: 3.8, vol: 0.22, wave: 'sine' as Wave },
    ],
  },

  /**
   * 타 버렸다 — 시간이 다해 판이 끝났다(규칙 1).
   * 이쪽은 타는 소리다. 잡음을 높게 남겨 지글거리게 두고 위에서 눌러 끈다.
   */
  burnt: {
    /*
     * 어둡게 간다 — 상함이 '슬픔'이라면 이쪽은 '무거움'이다.
     * 음을 낮게 깔고, 반음 아래 트라이톤을 겹쳐 풀리지 않는 불협을 만든다.
     * 잡음은 끝까지 남겨 계속 타고 있게 둔다.
     */
    noise: [
      /*
       * 지글거림은 '탄다'를 말해 주지만 크면 소리가 얇아진다. 처음 쟀을 때
       * 영교차율이 상함의 2.4배로 나왔다 — 어두운 게 아니라 쉬익거리는 쪽이었다.
       * 잡음을 낮추고 어둠은 아래 저역이 맡는다.
       */
      { dur: 2.6, vol: 0.1, hp: 2200 },
      { dur: 0.3, vol: 0.09, at: 0.9, hp: 3400 },
      { dur: 0.3, vol: 0.08, at: 1.7, hp: 3400 },
      { dur: 0.9, vol: 0.2, at: 2.9, lp: 300 },
    ],
    tones: [
      // 낮은 솔. 바닥을 깔고 오래 버틴다
      { from: 98, dur: 4.4, vol: 0.36, hold: 2.8, wave: 'sawtooth' as Wave },
      /*
       * 트라이톤(증4도). 서양 음악에서 가장 안 풀리는 사이라 오래 들으면
       * 불안해진다 — 어둡게 만들려면 화음이 닫히면 안 된다.
       */
      { from: 139, dur: 4.0, at: 0.3, vol: 0.24, hold: 2.4, wave: 'sawtooth' as Wave },
      // 위에서 천천히 내려앉아 덮는다
      { from: 392, to: 104, dur: 3.2, at: 0.15, vol: 0.18, wave: 'triangle' as Wave },
      // 마지막으로 더 아래로 꺼진다
      { from: 78, to: 38, dur: 1.6, at: 3.4, vol: 0.3, wave: 'sine' as Wave },
    ],
  },

  /* --- 도우 만들기 --- */
  /** 재료를 올렸다 — 툭 얹히는 소리 */
  place: {
    tones: [{ from: 300, to: 180, dur: 0.09, vol: 0.26, wave: 'triangle' as Wave }],
    noise: [{ dur: 0.05, vol: 0.14, hp: 700 }],
  },
  /** 주사위 한 칸 구를 때 */
  tick: { noise: [{ dur: 0.03, vol: 0.2, hp: 1800 }] },

  /* --- 숙성 (전자레인지 → 땡 → 두구두구 → 팡파레) --- */
  /**
   * 카운트. 전자레인지가 남은 시간을 세는 소리 — 맑은 사각파 한 점.
   * 잡음(tick)이 아니라 음정이 있어야 '기계가 세고 있다'로 들린다.
   */
  beep: { tones: [{ from: 880, dur: 0.06, vol: 0.3, wave: 'square' as Wave }] },

  /**
   * 땡! 다 됐다.
   *
   * 종소리는 배음이 정수배에서 살짝 어긋나 있다. 정확히 2배·3배로 쌓으면
   * 오르간처럼 들리고 종이 안 된다. 그래서 2.02·2.98 로 비껴 둔다.
   * 여운이 길어야 '땡—' 하고 남는다.
   */
  ding: {
    noise: [{ dur: 0.03, vol: 0.18, hp: 3000 }],
    tones: [
      { from: 1046, dur: 1.1, vol: 0.3, wave: 'sine' as Wave },
      { from: 2113, dur: 0.9, vol: 0.16, wave: 'sine' as Wave },
      { from: 3117, dur: 0.6, vol: 0.09, wave: 'sine' as Wave },
      { from: 523, dur: 1.2, vol: 0.12, wave: 'triangle' as Wave },
    ],
  },

  /**
   * 두구두구두구. 잡음을 낮게 깎아 북 가죽처럼 쓰고 아래에 몸통을 깐다.
   * 뒤로 갈수록 빨라지고 커진다 — 그래야 무언가 나올 것 같아진다.
   */
  drumroll: {
    noise: Array.from({ length: 22 }, (_, i) => {
      const t = i / 21
      return {
        // 간격이 0.055 → 0.028 로 좁아진다
        at: i * (0.055 - t * 0.027),
        dur: 0.05,
        vol: 0.1 + t * 0.16,
        lp: 900,
      }
    }),
    tones: Array.from({ length: 22 }, (_, i) => {
      const t = i / 21
      return {
        at: i * (0.055 - t * 0.027),
        from: 96,
        to: 62,
        dur: 0.045,
        vol: 0.12 + t * 0.14,
        wave: 'sine' as Wave,
      }
    }),
  },

  /* --- 프롤로그 --- */
  /**
   * 트랙터가 다가온다 — 통통통통 튀는 디젤 엔진의 점화음.
   *
   * 처음엔 이어지는 드론(엔진 하나가 웅웅대는 소리)으로 만들었더니 우주선처럼
   * 들렸다. 트랙터는 한 실린더씩 따로 터지는 소리라, 노이즈(기계 마찰)와
   * 짧게 꺾이는 톱니(실린더 점화)를 한 쌍으로 묶어 또각또각 끊어 친다.
   * 간격이 좁아지며(0.14→0.095s) 점점 가까이·잦게 다가온다.
   */
  harvest: {
    noise: Array.from({ length: 16 }, (_, i) => {
      const t = i / 15
      return {
        at: i * (0.14 - t * 0.045),
        dur: 0.07,
        vol: 0.12 + t * 0.2,
        lp: 500 + t * 200,
      }
    }),
    tones: Array.from({ length: 16 }, (_, i) => {
      const t = i / 15
      return {
        at: i * (0.14 - t * 0.045),
        from: 62 + t * 8,
        to: 40,
        dur: 0.09,
        vol: 0.16 + t * 0.14,
        wave: 'sawtooth' as Wave,
      }
    }),
  },

  /**
   * 못 알아듣는 목소리 하나 — 자막으로만 뜻이 전해지는 장면에 깐다.
   *
   * 실제 말소리가 아니라 음절 하나하나를 짧은 사각파 블립으로 흉내 낸다
   * (애니멀레이즈 방식). 높낮이를 들쭉날쭉 둬야 '말하는 것처럼' 들린다 —
   * 다 같은 높이면 모스 부호처럼 들린다.
   */
  gibberish: {
    tones: [
      { from: 340, dur: 0.06, vol: 0.24, wave: 'square' as Wave },
      { from: 480, dur: 0.05, at: 0.07, vol: 0.24, wave: 'square' as Wave },
      { from: 260, dur: 0.06, at: 0.13, vol: 0.22, wave: 'square' as Wave },
      { from: 520, dur: 0.05, at: 0.2, vol: 0.24, wave: 'square' as Wave },
      { from: 300, dur: 0.06, at: 0.27, vol: 0.22, wave: 'square' as Wave },
      { from: 440, dur: 0.05, at: 0.34, vol: 0.24, wave: 'square' as Wave },
      { from: 380, dur: 0.06, at: 0.41, vol: 0.22, wave: 'square' as Wave },
      { from: 500, dur: 0.06, at: 0.48, vol: 0.24, wave: 'square' as Wave },
    ],
  },
  /** 다른 목소리 — gibberish 와 같은 방식이되 한 옥타브 위, 더 잘게 끊는다 */
  gibberish2: {
    tones: [
      { from: 620, dur: 0.045, vol: 0.22, wave: 'square' as Wave },
      { from: 860, dur: 0.04, at: 0.05, vol: 0.22, wave: 'square' as Wave },
      { from: 540, dur: 0.045, at: 0.1, vol: 0.2, wave: 'square' as Wave },
      { from: 900, dur: 0.04, at: 0.15, vol: 0.22, wave: 'square' as Wave },
      { from: 700, dur: 0.045, at: 0.2, vol: 0.2, wave: 'square' as Wave },
      { from: 780, dur: 0.04, at: 0.25, vol: 0.22, wave: 'square' as Wave },
      { from: 600, dur: 0.045, at: 0.3, vol: 0.2, wave: 'square' as Wave },
      { from: 920, dur: 0.05, at: 0.35, vol: 0.24, wave: 'square' as Wave },
    ],
  },

  /** 결과 발표 — 도-미-솔-도 를 올라간 뒤 화음을 길게 놓는다 */
  tada: {
    tones: [
      { from: 523, dur: 0.1, vol: 0.28, wave: 'triangle' as Wave },
      { from: 659, dur: 0.1, at: 0.08, vol: 0.28, wave: 'triangle' as Wave },
      { from: 784, dur: 0.1, at: 0.16, vol: 0.28, wave: 'triangle' as Wave },
      { from: 1047, dur: 0.62, at: 0.25, vol: 0.3, wave: 'triangle' as Wave },
      { from: 659, dur: 0.62, at: 0.25, vol: 0.15, wave: 'sine' as Wave },
      { from: 784, dur: 0.62, at: 0.25, vol: 0.13, wave: 'sine' as Wave },
      { from: 262, dur: 0.66, at: 0.25, vol: 0.14, wave: 'triangle' as Wave },
    ],
  },
  /** 굽기 — 화덕에 들어간다 */
  bake: {
    noise: [{ dur: 0.5, vol: 0.2, hp: 300 }],
    tones: [
      { from: 160, to: 620, dur: 0.5, vol: 0.24, wave: 'sawtooth' as Wave },
      { from: 320, to: 1240, dur: 0.45, at: 0.06, vol: 0.14, wave: 'sine' as Wave },
    ],
  },
  /** 보상 카드를 골랐다 */
  card: {
    tones: [
      { from: 700, dur: 0.07, vol: 0.26, wave: 'triangle' as Wave },
      { from: 1050, dur: 0.16, at: 0.06, vol: 0.26, wave: 'triangle' as Wave },
    ],
  },
} satisfies Record<string, Spec>

export type SoundName = keyof typeof SPECS

export function play(name: SoundName): void {
  if (!ensure() || !ctx) return
  const spec: Spec = SPECS[name]
  const now = ctx.currentTime
  for (const t of spec.tones ?? []) tone(t, now)
  for (const n of spec.noise ?? []) noise(n, now)
}
