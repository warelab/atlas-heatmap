import React from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Modal, Nav, Row } from 'react-bootstrap'

import { groupedColumnPropTypes,columnCategoryPropTypes } from '../../chartDataPropTypes.js'

import FilterOption from './FilterOption.js'
import sortBy from 'lodash/sortBy.js'

import CategoryCheckboxes from './CategoryCheckboxes.js'

import { groupIntoPairs } from '../../../utils.js'
import { Sliders } from '../icons.js'

import { uncontrollable } from 'uncontrollable'

const buttonUnsetStyles = {
  textTransform: `unset`,
  letterSpacing: `unset`,
  height: `unset`
}

// Bootstrap 5 nav tabs (the grouping tabs in the header) and vertical pills (the categories)
const navTabs = (variant) => (
  ({allTabs, disabledTabs=[], currentTab, onChangeCurrentTab}) => (
    <Nav
      variant={variant}
      className={variant === `pills` ? `flex-column` : undefined}
      activeKey={currentTab}
      onSelect={onChangeCurrentTab}
      style={{fontSize: `medium`}}>
      {
        allTabs.map((tab) => (
          <Nav.Item key={tab}>
            <Nav.Link eventKey={tab} disabled={disabledTabs.includes(tab)}>
              {tab}
            </Nav.Link>
          </Nav.Item>
        ))
      }
    </Nav>
  )
)

const topRibbonTabs = navTabs(`tabs`)
const categoryTabs = navTabs(`pills`)

const _FiltersModal = ({
  showModal,
  onCloseModal,
  tabNames: allTopTabs,
  currentTopTab,
  onChangeCurrentTopTab,
  categories,
  categoryCheckboxes,
  currentValues,
  allValues,
  onChangeCurrentValues
}) => (
  // Rendered in a portal outside .gxaHeatmapContainer: .gxa-heatmap-modal scopes its styles (src/styles/heatmap.css)
  <Modal show={showModal}
    onHide={onCloseModal}
    size={`lg`}
    className={`gxa-heatmap-modal`} >
    <Modal.Header closeButton>
      {allTopTabs.length > 1
        ? topRibbonTabs({allTabs: allTopTabs, currentTab: currentTopTab, onChangeCurrentTab: onChangeCurrentTopTab})
        : <Modal.Title> Filters </Modal.Title>
      }
    </Modal.Header>

    <Modal.Body >
      <Row>
        <Col sm={9}>
          <CategoryCheckboxes categories={categoryCheckboxes}
            allValues={allValues}
            currentValues={currentValues}
            currentTab={(categories.find(category => allValues.every(value=> (
              currentValues.some(currentValue => currentValue.value === value.value) === value.categories.includes(category.name)
            )) && !category.disabled) || {name: ``}).name}
            onChangeCurrentValues={onChangeCurrentValues}
          />
        </Col>

        <Col sm={3}>
          {
            categoryTabs({
              allTabs: categories.map(c => c.name),
              disabledTabs: categories.filter(c => c.disabled).map(c => c.name),
              currentTab:(categories.find(category => allValues.every(value=> (
                currentValues.some(currentValue => currentValue.value === value.value) === value.categories.includes(category.name)
              )) && !category.disabled) || {name: ``}).name,
              onChangeCurrentTab: (categoryName) => onChangeCurrentValues(
                allValues
                  .filter(e=>e.categories.includes(categoryName))
              )
            })
          }
        </Col>
      </Row>
      <div style={{marginLeft: `20px`, columnCount: `2`}}>
        {
          sortBy(
            groupIntoPairs(
              [].concat.apply([],
                allValues
                  .map(v =>
                    (v.groupings.find(g => g.name === currentTopTab) || {values:[]})
                      .values
                      .map(group => [group.label, v.value])
                  )
              ),
              `0`
            ).map(a => [a[0], [].concat.apply([], a[1].map(aa=> aa[1]))]),
            a => a[0] === `Unmapped` ? `_` : ` ${a[0]}` //makes Unmapped go last
          ).map(a => (
            <FilterOption
              key={a[0]}
              defaultIsOpen={false}
              name={a[0]}
              allValues={a[1]}
              currentValues={a[1].filter(v => currentValues.some(c=> c.value === v))}
              onChangeCurrentValues={(newCurrentValues) => onChangeCurrentValues(
                allValues.filter(v=>
                  a[1].includes(v.value)
                    ? newCurrentValues.includes(v.value)
                    : currentValues.some(c => c.value === v.value)
                )
              )}
            />
          ))
        }
      </div>
    </Modal.Body>

    <Modal.Footer>
      <Button variant={`secondary`}
        onClick={onCloseModal}
        style={buttonUnsetStyles}>
        Close
      </Button>
    </Modal.Footer>
  </Modal>
)

const FiltersModal = uncontrollable(_FiltersModal, {
  currentTopTab : `onChangeCurrentTopTab`
})

// The title sits on a wrapper: a disabled button shows no tooltip
const FiltersButton = ({disabled,onClickButton}) => (
  <span title={disabled ? `Reset zoom to enable filters` : undefined}>
    <Button size={`sm`}
      variant={`outline-secondary`}
      onClick={onClickButton}
      disabled={disabled}
      style={buttonUnsetStyles}>
      <Sliders/><span style={{verticalAlign: `middle`}}> Filters</span>
    </Button>
  </span>
)

const _Main = props => (
  <div>
    <FiltersButton
      disabled={props.disabled}
      onClickButton={() => props.onChangeShowModal(true)}/>
    <FiltersModal
      {...props}
      onCloseModal={() => props.onChangeShowModal(false)}
      defaultCurrentTopTab={props.tabNames[0] || ``}
      defaultCurrentCategory={props.categories.find(c => !c.disabled)}
    />
  </div>
)

_Main.propTypes = {
  categories: PropTypes.arrayOf(columnCategoryPropTypes).isRequired,
  categoryCheckboxes: PropTypes.arrayOf(columnCategoryPropTypes).isRequired,
  allValues: PropTypes.arrayOf(groupedColumnPropTypes).isRequired,
  currentValues: PropTypes.arrayOf(groupedColumnPropTypes).isRequired,
  disabled : PropTypes.bool.isRequired,
  onChangeCurrentValues:PropTypes.func.isRequired,
  tabNames: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChangeShowModal: PropTypes.func.isRequired,
  showModal: PropTypes.bool.isRequired,
}

// Callers pass defaultShowModal={false} (no defaultProps)
const Main = uncontrollable(_Main, {
  showModal: `onChangeShowModal`,
})

export default Main
