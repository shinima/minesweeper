import React, { useRef, useState } from 'react'
import { Range, Set } from 'immutable'
import Number from './components/Number'
import { Cover, Face, Flag, LED, Mine, QuestionMark } from './components/elements'
import { Grid, View } from './components/layouts'
import Indicators from './components/Indicators'
import { neighbors } from './common'
import { LEFT_CLICK, MIDDLE_CLICK, RESTART, RIGHT_CLICK } from './actions'
import { CELL, COLS, MODES, ROWS, GAME_STATUS } from './constants'
import useSaga from '@little-saga/use-saga'
import rootSaga from './sagas'
import reducer from './reducer'

const LEFT_BUTTON = 0
const MIDDLE_BUTTON = 1
const RIGHT_BUTTON = 2

function preventDefault(e) {
  e.preventDefault()
}

function CoverContainer({ modes, btn1, btn2, point }) {
  let dontNeedCover = Set()

  if (point !== -1) {
    if (btn1) {
      dontNeedCover = Set([point])
    } else if (btn2) {
      dontNeedCover = Set(neighbors(point))
    }
  }
  const covers = []
  Range(0, ROWS * COLS).forEach(t => {
    const row = Math.floor(t / COLS)
    const col = Math.floor(t % COLS)
    const mode = modes.get(t)
    if (
      (mode === MODES.COVERED && !dontNeedCover.has(t)) ||
      mode === MODES.FLAG ||
      mode === MODES.QUESTIONED
    ) {
      covers.push(<Cover key={t} row={row} col={col} />)
    }
  })
  return covers
}

function ElementContainer({ modes, mines }) {
  const elements = []
  Range(0, ROWS * COLS).forEach(t => {
    const row = Math.floor(t / COLS)
    const col = Math.floor(t % COLS)
    const mode = modes.get(t)
    if (mode === MODES.UNCOVERED) {
      if (mines.get(t) === -1) {
        elements.push(<Mine key={t} row={row} col={col} />)
      } else if (mines.get(t) > 0) {
        // >= 0
        elements.push(<Number key={t} row={row} col={col} number={mines.get(t)} />)
      }
    } else if (mode === MODES.FLAG) {
      elements.push(<Flag key={t} row={row} col={col} />)
    } else if (mode === MODES.QUESTIONED) {
      elements.push(<QuestionMark key={t} row={row} col={col} />)
    } else if (mode === MODES.CROSS) {
      elements.push(<Mine key={t} row={row} col={col} cross />)
    } else if (mode === MODES.EXPLODED) {
      elements.push(<Mine key={t} row={row} col={col} exploded />)
    }
  })
  return elements
}

export default function App() {
  const [{ status, mines, modes, timer, indicators }, dispatch] = useSaga({
    saga: rootSaga,
    reducer,
    initialAction: { type: 'init' },
  })

  const [leftPressed, setLeftPressed] = useState(false)
  const [middlePressed, setMiddlePressed] = useState(false)
  const [facePressed, setFacePressed] = useState(false)
  // 鼠标当前的位置，仅在 左键按下 或是 中键按下的情况下有效
  const [point, setPoint] = useState(-1)

  const svgRef = useRef()

  const isgameon = status === GAME_STATUS.IDLE || status === GAME_STATUS.ON
  const mineCount = mines.filter(mine => mine === -1).count()
  const flagCount = modes.filter(mode => mode === MODES.FLAG).count()

  return (
    <svg
      className="svg"
      ref={svgRef}
      width={COLS * CELL + 16}
      height={59 + 16 * ROWS}
      onContextMenu={preventDefault}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      <View border={2} x={5} y={5} width={COLS * CELL + 6} height={37}>
        <LED x={5} y={4} number={mineCount - flagCount} />
        {renderFace()}
        <LED x={CELL * COLS - 46} y={4} number={timer} />
      </View>
      <View border={3} x={5} y={48} width={COLS * CELL + 6} height={ROWS * CELL + 6}>
        <Grid />
        <ElementContainer modes={modes} mines={mines} />
        <CoverContainer modes={modes} btn1={leftPressed} btn2={middlePressed} point={point} />
        <Indicators indicators={indicators.filter((_, t) => modes.get(t) === MODES.COVERED)} />
      </View>
    </svg>
  )

  // region
  function onMouseDown(event) {
    const result = calculate(event)
    if (event.button === LEFT_BUTTON) {
      if (result.isFace) {
        setFacePressed(true)
      } else if (isgameon && !leftPressed) {
        setLeftPressed(true)
        setMiddlePressed(false)
        setPoint(result.t)
      }
    } else if (event.button === MIDDLE_BUTTON) {
      event.preventDefault()
      if (isgameon && !middlePressed) {
        setLeftPressed(false)
        setMiddlePressed(true)
        setPoint(result.t)
      }
    } else if (event.button === RIGHT_BUTTON) {
      if (isgameon && result.valid) {
        dispatch({ type: RIGHT_CLICK, t: result.t })
      }
    }
  }

  function onMouseMove(event) {
    if (leftPressed || middlePressed) {
      const result = calculate(event)
      if (result.valid) {
        setPoint(result.t)
      }
    }
  }

  function onMouseUp(event) {
    if (event.button === LEFT_BUTTON) {
      if (facePressed) {
        setFacePressed(false)
        dispatch({ type: RESTART })
      } else if (leftPressed) {
        setLeftPressed(false)
        const result = calculate(event)
        if (result.valid) {
          dispatch({ type: LEFT_CLICK, t: result.t })
        }
      }
    } else if (event.button === MIDDLE_BUTTON) {
      if (middlePressed) {
        setMiddlePressed(false)
        const result = calculate(event)
        if (result.valid) {
          dispatch({ type: MIDDLE_CLICK, t: result.t })
        }
      }
    } // else other button, ignore
  }

  function calculate({ clientX, clientY }) {
    const svgRect = svgRef.current.getBoundingClientRect()
    const x = clientX - svgRect.left
    const y = clientY - svgRect.top

    // 判断是否点击到了face
    const faceSize = 26
    const faceOffsetX = 7
    const faceOffsetY = 7
    const faceLeft = (CELL / 2) * COLS - 12 + faceSize / 2
    if (
      faceLeft <= x + faceOffsetX &&
      x + faceOffsetX <= faceLeft + faceSize &&
      y >= 4 + faceOffsetY &&
      y <= 4 + faceOffsetY + faceSize
    ) {
      return { row: 0, col: 0, valid: false, t: -1, isFace: true }
    }

    const row = Math.floor((y - 51) / CELL)
    const col = Math.floor((x - 8) / CELL)
    const valid = row >= 0 && row < ROWS && col >= 0 && col <= COLS
    const t = row * COLS + col
    return { row, col, valid, t: valid ? t : -1 }
  }

  function renderFace() {
    let faceType = 'smiling'
    if (status === GAME_STATUS.WIN) {
      faceType = 'sunglasses'
    } else if (status === GAME_STATUS.LOSE) {
      faceType = 'sad'
    } else if (leftPressed || middlePressed) {
      faceType = 'surprised'
    }
    return <Face type={faceType} x={(CELL / 2) * COLS - 12} y={4} pressed={facePressed} />
  }
  // endregion
}
