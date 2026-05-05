import sortHand from '../utils/sorthand.js'
import { LocalGameState, SEAT_NAMES } from './LocalGameState.js'
import { chooseDiscard, decideClaim } from './AIPlayer.js'

const CHINESE_WINDS = { east: '东', south: '南', west: '西', north: '北' }
const AI_THINK_MS = 700
const HUMAN_CLAIM_WINDOW_MS = 3000

// Seat 0 = human (main, east), 1 = right (south), 2 = top (west), 3 = left (north)
const SEAT_TO_AREA = { 0: 'main', 1: 'right', 2: 'top', 3: 'left' }
const HAND_IDS = { main: 'playerHand', right: 'rightPlayerHand', top: 'topPlayerHand', left: 'leftPlayerHand' }
const CHECKED_IDS = { main: 'playerChecked', right: 'rightPlayerChecked', top: 'topPlayerChecked', left: 'leftPlayerChecked' }
const DISCARD_IDS = { main: 'playerDiscardPile', right: 'rightPlayerDiscard', top: 'topPlayerDiscard', left: 'leftPlayerDiscard' }
const SEAT_LABEL_IDS = { main: 'mainSeatLabel', right: 'rightSeatLabel', top: 'topSeatLabel', left: 'leftSeatLabel' }
const WIND_SELECTORS = { main: '.bottomcontrols .playerWind', right: '.rightcontrols .playerWind', top: '.topcontrols .playerWind', left: '.leftcontrols .playerWind' }

window.addEventListener('DOMContentLoaded', () => {
  const state = new LocalGameState()
  const banner = document.getElementById('turnBanner')
  const eatOptions = document.getElementById('eatOptions')
  const gameLog = document.getElementById('gameLog')

  document.getElementById('userName').textContent = 'Practice mode'
  document.getElementById('logout').addEventListener('click', () => {
    window.location.pathname = '/lobby'
  })
  // Disable chat in practice mode (no peer to talk to).
  document.querySelector('.messenger.card')?.style.setProperty('display', 'none')

  const log = (msg) => {
    if (!gameLog) return
    const line = document.createElement('div')
    line.textContent = msg
    gameLog.appendChild(line)
    gameLog.scrollTop = gameLog.scrollHeight
  }

  const makeTileEl = (tile, opts = {}) => {
    const div = document.createElement('div')
    div.classList.add('tile')
    if (tile.name) div.classList.add(tile.name)
    if (tile.index != null) div.id = String(tile.index)
    if (opts.onClick) div.addEventListener('click', () => opts.onClick(tile))
    const img = document.createElement('img')
    img.src = tile.url
    div.appendChild(img)
    return div
  }

  const renderArea = (seat) => {
    const area = SEAT_TO_AREA[seat]
    const player = state.players[seat]
    const handEl = document.getElementById(HAND_IDS[area])
    const checkedEl = document.getElementById(CHECKED_IDS[area])
    const discardEl = document.getElementById(DISCARD_IDS[area])

    handEl.innerHTML = ''
    checkedEl.innerHTML = ''
    discardEl.innerHTML = ''

    if (seat === 0) {
      const sorted = sortHand(player.hand, 'name')
      sorted.forEach((tile) => {
        handEl.appendChild(makeTileEl(tile, {
          onClick: (t) => onHumanDiscard(t),
        }))
      })
    } else {
      // Face-down hand: jade-backed tiles, count matches their hand size.
      player.hand.forEach(() => {
        const back = document.createElement('div')
        back.classList.add('tile', 'tile--back')
        back.setAttribute('aria-hidden', 'true')
        handEl.appendChild(back)
      })
    }

    player.checked.forEach((tile) => checkedEl.appendChild(makeTileEl(tile)))
    player.discarded.forEach((tile) => discardEl.appendChild(makeTileEl(tile)))
  }

  const renderAll = () => [0, 1, 2, 3].forEach(renderArea)

  const setupSeats = () => {
    Object.entries(SEAT_TO_AREA).forEach(([seat, area]) => {
      const player = state.players[+seat]
      document.getElementById(SEAT_LABEL_IDS[area]).textContent =
        `${player.name} · ${CHINESE_WINDS[player.wind]}`
      const windEl = document.querySelector(WIND_SELECTORS[area])
      if (windEl) {
        windEl.textContent = CHINESE_WINDS[player.wind]
        windEl.id = player.wind
      }
    })
  }

  const setBanner = (text, tone = 'info') => {
    if (!banner) return
    banner.textContent = text
    banner.dataset.tone = tone
  }

  const clearOptions = () => { eatOptions.innerHTML = '' }

  const showEndScreen = () => {
    clearOptions()
    const wrap = document.createElement('div')
    const msg = document.createElement('div')
    if (state.winner) {
      const verb = state.winner.type === 'self-draw' ? 'self-drew' : 'won on discard'
      msg.textContent = `🀄 ${state.winner.name} ${verb}!`
      setBanner(`Round over — ${state.winner.name} wins`, 'win')
    } else {
      msg.textContent = '🀫 Wall exhausted — draw round.'
      setBanner('Round over — draw', 'draw')
    }
    msg.style.marginBottom = '10px'
    const restart = document.createElement('button')
    restart.className = 'waves-effect waves-light btn-small'
    restart.textContent = 'Play again'
    restart.addEventListener('click', () => {
      state.reset()
      setupSeats()
      renderAll()
      clearOptions()
      setBanner('')
      if (gameLog) gameLog.innerHTML = ''
      log('New round started.')
      runTurn()
    })
    wrap.appendChild(msg)
    wrap.appendChild(restart)
    eatOptions.appendChild(wrap)
  }

  // Sequence: draw → check self-draw win → discard → resolve claims → advance.
  const runTurn = () => {
    if (state.roundEnd) { showEndScreen(); return }
    const seat = state.currentSeat
    const player = state.players[seat]
    setBanner(`${player.name}'s turn (${CHINESE_WINDS[player.wind]})`)

    state.drawForCurrent()
    if (state.roundEnd) { renderAll(); showEndScreen(); return }
    renderArea(seat)

    if (seat === 0) {
      humanTurn()
    } else {
      setTimeout(() => aiTurn(seat), AI_THINK_MS)
    }
  }

  const humanTurn = () => {
    clearOptions()
    if (state.canSelfDrawWin(0)) {
      const winBtn = document.createElement('button')
      winBtn.className = 'waves-effect waves-light btn-small'
      winBtn.textContent = '胡! Declare win'
      winBtn.addEventListener('click', () => {
        state.declareWin(0, 'self-draw')
        log('You declared a self-draw win.')
        renderAll()
        showEndScreen()
      })
      eatOptions.appendChild(winBtn)
    }
    setBanner('Your turn — pick a tile to discard')
  }

  const onHumanDiscard = (tile) => {
    if (state.roundEnd) return
    if (state.currentSeat !== 0 || !state.awaitingDiscard) return
    state.discard(0, tile.index)
    log(`You discarded ${tile.name}.`)
    clearOptions()
    renderArea(0)
    afterDiscard()
  }

  const aiTurn = (seat) => {
    if (state.roundEnd) { showEndScreen(); return }
    const player = state.players[seat]
    if (state.canSelfDrawWin(seat)) {
      state.declareWin(seat, 'self-draw')
      log(`${player.name} declared a self-draw win.`)
      renderAll()
      showEndScreen()
      return
    }
    const tile = chooseDiscard(player.hand)
    state.discard(seat, tile.index)
    log(`${player.name} discarded ${tile.name}.`)
    renderArea(seat)
    afterDiscard()
  }

  // After any discard, give other seats a chance to claim.
  const afterDiscard = () => {
    const discarderSeat = state.lastDiscardSeat
    const discardTile = state.lastDiscard
    if (!discardTile) { state.advanceTurn(); runTurn(); return }

    // 1) AI claims (in priority order: win > pong; check from next seat clockwise).
    for (let offset = 1; offset <= 3; offset += 1) {
      const seat = (discarderSeat + offset) % 4
      if (seat === 0) continue
      const decision = decideClaim(state, seat)
      if (decision?.kind === 'win') {
        state.declareWin(seat, 'discard')
        log(`${state.players[seat].name} won on your discard.`)
        renderAll()
        showEndScreen()
        return
      }
      if (decision?.kind === 'pong') {
        state.applyClaim(seat, decision.combo)
        log(`${state.players[seat].name} ponged ${discardTile.name}.`)
        renderArea(discarderSeat)
        renderArea(seat)
        if (seat === 0) humanTurn()
        else setTimeout(() => aiTurn(seat), AI_THINK_MS)
        return
      }
    }

    // 2) Human claim window (only if discarder isn't the human).
    if (discarderSeat !== 0) {
      const canWin = state.canWinOnDiscard(0, discardTile)
      const canPong = state.canPong(0, discardTile)
      const chow = state.chowOptions(0, discardTile, discarderSeat)

      if (canWin || canPong || chow.length > 0) {
        showHumanClaimOptions({ canWin, canPong, chow })
        return
      }
    }

    // 3) No claim → next seat draws.
    state.advanceTurn()
    runTurn()
  }

  const showHumanClaimOptions = ({ canWin, canPong, chow }) => {
    clearOptions()
    setBanner('Claim or pass?')
    let resolved = false
    const passAndContinue = () => {
      if (resolved) return
      resolved = true
      clearOptions()
      state.advanceTurn()
      runTurn()
    }
    const claim = (fn) => () => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutId)
      fn()
    }
    const timeoutId = setTimeout(passAndContinue, HUMAN_CLAIM_WINDOW_MS)

    const tile = state.lastDiscard

    if (canWin) {
      const btn = document.createElement('button')
      btn.className = 'waves-effect waves-light btn-small'
      btn.textContent = `胡! Win on ${tile.name}`
      btn.addEventListener('click', claim(() => {
        state.declareWin(0, 'discard')
        log(`You won on ${tile.name}.`)
        renderAll()
        showEndScreen()
      }))
      eatOptions.appendChild(btn)
    }
    if (canPong) {
      const btn = document.createElement('button')
      btn.className = 'waves-effect waves-light btn-small'
      btn.textContent = `Pong (${tile.name})`
      btn.addEventListener('click', claim(() => {
        const discarderSeat = state.lastDiscardSeat
        state.applyClaim(0, [tile.name, tile.name])
        log(`You ponged ${tile.name}.`)
        renderArea(discarderSeat)
        renderArea(0)
        clearOptions()
        humanTurn()
      }))
      eatOptions.appendChild(btn)
    }
    chow.forEach((combo) => {
      const btn = document.createElement('button')
      btn.className = 'waves-effect waves-light btn-small'
      btn.textContent = `Chow (${combo.join(', ')})`
      btn.addEventListener('click', claim(() => {
        const discarderSeat = state.lastDiscardSeat
        state.applyClaim(0, combo)
        log(`You chowed ${tile.name}.`)
        renderArea(discarderSeat)
        renderArea(0)
        clearOptions()
        humanTurn()
      }))
      eatOptions.appendChild(btn)
    })

    const pass = document.createElement('button')
    pass.className = 'waves-effect btn-flat btn-small'
    pass.textContent = 'Pass'
    pass.addEventListener('click', passAndContinue)
    eatOptions.appendChild(pass)
  }

  setupSeats()
  renderAll()
  log(`Practice round started. You are ${SEAT_NAMES[0]} (East).`)
  runTurn()
})
