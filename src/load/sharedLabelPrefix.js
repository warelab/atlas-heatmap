// Column labels can repeat a long stretch of text at the start of every column: Warelab's GXA API names differential
// contrasts after all their factors, e.g. 49 contrasts of E-GEOD-128441 that all begin "environmental stress: none vs
// drought environment " and run to 146 characters. The shared start is shown once, as the axis title, and each column
// label keeps only what follows it (shortLabel); `label` stays whole for the tooltip, the filters and the download.

// Less shared text than this is left in the labels
const MIN_SHARED_LENGTH = 15

const commonPrefix = (a, b) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++
  }
  return a.slice(0, i)
}

// The text every label starts with, ending at a space so that no word is split, or `` if it is too short to be worth
// taking out or would leave a label empty
const sharedLabelPrefix = labels => {
  if (labels.length < 2) {
    return ``
  }
  const common = labels.reduce(commonPrefix)
  const prefix = common.slice(0, common.lastIndexOf(` `) + 1)
  return prefix.trim().length >= MIN_SHARED_LENGTH && labels.every(label => label.slice(prefix.length).trim()) ?
    prefix :
    ``
}

// xAxisCategories with a shortLabel (the label without the shared prefix) when they share one
const withShortLabels = xAxisCategories => {
  const prefix = sharedLabelPrefix(xAxisCategories.map(category => category.label))
  return prefix ?
    xAxisCategories.map(category => ({...category, shortLabel: category.label.slice(prefix.length).trim()})) :
    xAxisCategories
}

// The prefix the columns share, recovered from a category with a shortLabel (filters and orderings keep categories)
const sharedLabelOf = xAxisCategories => {
  const shortened = xAxisCategories.find(category => category.shortLabel)
  return shortened ? shortened.label.slice(0, shortened.label.length - shortened.shortLabel.length).trim() : ``
}

// What a column shows
const displayedLabel = category => category.shortLabel || category.label

export {sharedLabelPrefix, withShortLabels, sharedLabelOf, displayedLabel, MIN_SHARED_LENGTH}
