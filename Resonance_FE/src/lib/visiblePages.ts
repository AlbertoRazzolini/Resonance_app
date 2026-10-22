/** Da questo numero di pagine in giù si mostrano tutte; oltre, solo le vicine alla corrente, la prima e l'ultima. */
const ALL_PAGES_MAX = 7

/**
 * Le pagine da disegnare nei numeri di pagina, come indici da 0; `null` è un salto («…»). Con molte pagine restano la
 * prima, l'ultima e le due accanto alla corrente; un salto di una sola pagina si riempie con quella pagina invece dei puntini.
 */
export function visiblePages(page: number, totalPages: number): (number | null)[] {
  if (totalPages <= ALL_PAGES_MAX) return Array.from({ length: totalPages }, (_, index) => index)

  const wanted = new Set([0, page - 1, page, page + 1, totalPages - 1])
  const sorted = [...wanted].filter((index) => index >= 0 && index < totalPages).sort((a, b) => a - b)

  const result: (number | null)[] = []
  sorted.forEach((index, position) => {
    const previous = sorted[position - 1]
    if (previous !== undefined && index - previous === 2) result.push(previous + 1)
    else if (previous !== undefined && index - previous > 2) result.push(null)
    result.push(index)
  })
  return result
}
