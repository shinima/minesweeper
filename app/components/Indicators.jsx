import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { CELL, COLS } from 'constants'

const colorMap = {
  mine: 'red',
  safe: 'green',
  danger: 'orange',
}

const Indicator = ({ row, col, type }) => (
  <rect
    x={col * CELL}
    y={row * CELL}
    width={CELL + 1}
    height={CELL + 1}
    fill={colorMap[type]}
  />
)
Indicator.propTypes = {
  row: React.PropTypes.number.isRequired,
  col: React.PropTypes.number.isRequired,
  type: React.PropTypes.string.isRequired,
}

export default class Indicators extends React.Component {
  static propTypes = {
    indicators: ImmutablePropTypes.mapOf(React.PropTypes.string).isRequired,
  }

  render() {
    const { indicators } = this.props

    return (
      <g role="indicators" fillOpacity="0.15">
        {indicators.map((type, t) =>
          <Indicator
            key={t}
            row={Math.floor(t / COLS)}
            col={t % COLS}
            type={type}
          />
        ).toArray()}
      </g>
    )
  }
}
